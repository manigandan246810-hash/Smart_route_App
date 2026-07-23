import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import { db, seedDatabase } from './db.js';
import { connectDB } from './config/database.js';
import { solveClassical, solveQuantumHybrid, AIRouteOptimizer } from '../quantum-service/optimizer.js';

// Load environment variables
dotenv.config();

const aiOptimizer = new AIRouteOptimizer();

// Connect to MongoDB Atlas
await connectDB();
// Seed database if empty
await seedDatabase();

// Haversine distance
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === lat2 && lon1 === lon2) return 0;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Generate road turn-by-turn route between coordinate stops
async function getRoadRoute(stops) {
    if (stops.length < 2) return [];

    try {
        const coordinates = stops.map(s => `${s.longitude},${s.latitude}`).join(';');
        const url = `http://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
                const geomCoords = data.routes[0].geometry.coordinates;
                return geomCoords.map(coord => ({
                    latitude: coord[1],
                    longitude: coord[0]
                }));
            }
        }
    } catch (e) {
        console.warn("OSRM routing service failed, falling back to simulated road path:", e);
    }

    // High fidelity local turn-by-turn simulation fallback
    const roadPoints = [];
    for (let i = 0; i < stops.length - 1; i++) {
        const start = stops[i];
        const end = stops[i+1];
        
        roadPoints.push({ latitude: start.latitude, longitude: start.longitude });
        
        const steps = 6;
        for (let s = 1; s < steps; s++) {
            const fraction = s / steps;
            
            let lat, lng;
            if (fraction < 0.5) {
                lat = start.latitude;
                lng = start.longitude + (end.longitude - start.longitude) * (fraction * 2);
            } else {
                lat = start.latitude + (end.latitude - start.latitude) * ((fraction - 0.5) * 2);
                lng = end.longitude;
            }
            
            const jitterLat = (Math.sin(fraction * Math.PI * 4) * 0.0003);
            const jitterLng = (Math.cos(fraction * Math.PI * 4) * 0.0003);
            
            roadPoints.push({
                latitude: Number((lat + jitterLat).toFixed(5)),
                longitude: Number((lng + jitterLng).toFixed(5))
            });
        }
    }
    roadPoints.push({ latitude: stops[stops.length-1].latitude, longitude: stops[stops.length-1].longitude });
    return roadPoints;
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
});

app.set('io', io);

io.on('connection', (socket) => {
    console.log(`Socket client connected: ${socket.id}`);
    
    socket.on('join', (data) => {
        if (data.userId) {
            socket.join(data.userId);
            console.log(`User ${data.userId} joined personal room`);
        }
        if (data.role) {
            socket.join(data.role);
            console.log(`User joined role room: ${data.role}`);
        }
    });

    socket.on('driver:location_update', async (data) => {
        try {
            const { driverId, tripId, gps, bearing, speed, batteryLevel, networkStatus, timestamp } = data;
            if (driverId && gps && gps.lat && gps.lng) {
                const syncPayload = {
                    driverId,
                    tripId,
                    gps,
                    bearing: bearing !== undefined ? bearing : 0,
                    speed: speed || 0,
                    batteryLevel: batteryLevel || 90,
                    networkStatus: networkStatus || 'Excellent',
                    clientTimestamp: timestamp || Date.now(),
                    serverTimestamp: Date.now()
                };

                // Instant zero-delay broadcast to admin room & all clients
                io.to('admin').emit('driver:location_changed', syncPayload);
                io.emit('driver:location_changed', syncPayload);
                io.emit('driver:location_update', syncPayload);

                // Async database update in background
                const updateData = { gps };
                if (speed !== undefined) updateData.currentSpeed = speed;
                if (batteryLevel !== undefined) updateData.batteryLevel = batteryLevel;
                if (networkStatus) updateData.networkStatus = networkStatus;
                db.drivers.update(driverId, updateData).catch(e => console.error(e));
            }
        } catch (e) {
            console.error('[Socket] Driver location update error:', e);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Socket client disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'smartroute_quantum_secret_key_987';

app.use(cors());
app.use(express.json());

// Real-time location update REST API
app.post('/api/drivers/:id/location', async (req, res) => {
    try {
        const driverId = req.params.id;
        const { gps, speed, batteryLevel, networkStatus } = req.body;
        const updateData = {};
        if (gps) updateData.gps = gps;
        if (speed !== undefined) updateData.currentSpeed = speed;
        if (batteryLevel !== undefined) updateData.batteryLevel = batteryLevel;
        if (networkStatus) updateData.networkStatus = networkStatus;

        const drv = await db.drivers.update(driverId, updateData);

        const io = req.app.get('io');
        if (io) {
            io.emit('driver:location_changed', {
                driverId,
                gps: drv.gps,
                speed: drv.currentSpeed,
                batteryLevel: drv.batteryLevel,
                networkStatus: drv.networkStatus,
                timestamp: new Date().toISOString()
            });
            io.emit('driver:location_update', {
                driverId,
                gps: drv.gps,
                speed: drv.currentSpeed,
                batteryLevel: drv.batteryLevel,
                networkStatus: drv.networkStatus,
                timestamp: new Date().toISOString()
            });
        }
        res.json({ success: true, driver: drv });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
});

// Dynamic AI Rerouting Evaluation Endpoint
app.post('/api/routes/reroute-check', async (req, res) => {
    try {
        const { tripId, driverGps, trafficEvents } = req.body;
        if (!tripId) return res.status(400).json({ message: 'tripId is required' });

        const trip = await db.trips.findOne(tripId);
        if (!trip || trip.status !== 'Active') {
            return res.json({ shouldReroute: false, reason: 'Trip not active' });
        }

        const orders = [];
        for (const oid of trip.orderIds) {
            const ord = await db.orders.findOne(oid);
            if (ord && ord.status !== 'Completed') {
                const cust = await db.customers.findOne(ord.customerId);
                if (cust) orders.push(cust);
            }
        }

        const rerouteEval = aiOptimizer.evaluateDynamicReroute({
            currentRoute: trip.roadRoute,
            driverGps: driverGps || { lat: 13.045, lng: 80.25 },
            targetStops: orders,
            trafficEvents: trafficEvents || []
        });

        if (rerouteEval.shouldReroute) {
            const stops = [
                { latitude: driverGps.lat, longitude: driverGps.lng },
                ...orders.map(o => ({ latitude: o.latitude, longitude: o.longitude }))
            ];
            const newRoadRoute = await getRoadRoute(stops);

            await db.trips.update(tripId, {
                roadRoute: newRoadRoute,
                expectedTime: Math.max(5, trip.expectedTime - rerouteEval.timeSavedMinutes),
                reroutedAt: new Date().toISOString()
            });

            const io = req.app.get('io');
            if (io) {
                io.emit('route:rerouted', {
                    tripId: trip.id,
                    driverId: trip.driverId,
                    roadRoute: newRoadRoute,
                    expectedTime: Math.max(5, trip.expectedTime - rerouteEval.timeSavedMinutes),
                    timeSavedMinutes: rerouteEval.timeSavedMinutes,
                    reason: rerouteEval.reason,
                    timestamp: Date.now()
                });
            }

            return res.json({
                success: true,
                shouldReroute: true,
                timeSavedMinutes: rerouteEval.timeSavedMinutes,
                reason: rerouteEval.reason,
                newRoadRoute
            });
        }

        return res.json({ success: true, shouldReroute: false, reason: rerouteEval.reason });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
});

// --- AUTHENTICATION MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access token missing' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

// --- AUTH ROUTER ---
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await db.users.findOne({ email, password });
    if (!user) {
        return res.status(401).json({ message: 'Invalid email or password credentials' });
    }
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    const user = await db.users.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// --- COLLECTION CRUD APIs ---
app.get('/api/warehouses', async (req, res) => res.json(await db.warehouses.find()));
app.post('/api/warehouses', async (req, res) => {
    const wh = await db.warehouses.create(req.body);
    res.json(wh);
});
app.put('/api/warehouses/:id', async (req, res) => {
    const wh = await db.warehouses.update(req.params.id, req.body);
    res.json(wh);
});
app.delete('/api/warehouses/:id', async (req, res) => {
    await db.warehouses.delete(req.params.id);
    res.json({ success: true, message: 'Warehouse deleted' });
});
app.post('/api/warehouses/:id/assign-vehicles', async (req, res) => {
    const warehouseId = req.params.id;
    const { vehicleIds } = req.body;
    for (const vid of vehicleIds) {
        await db.vehicles.update(vid, { warehouseId });
    }
    res.json({ success: true });
});

app.get('/api/customers', async (req, res) => res.json(await db.customers.find()));
app.get('/api/vehicles', async (req, res) => res.json(await db.vehicles.find()));

// Drivers collection
app.get('/api/drivers', async (req, res) => {
    res.json(await db.drivers.find());
});
app.post('/api/drivers', async (req, res) => {
    const drv = await db.drivers.create(req.body);
    res.json(drv);
});
app.put('/api/drivers/:id', async (req, res) => {
    const drv = await db.drivers.update(req.params.id, req.body);
    res.json(drv);
});
app.delete('/api/drivers/:id', async (req, res) => {
    await db.drivers.delete(req.params.id);
    res.json({ success: true, message: 'Driver deleted' });
});
app.post('/api/drivers/:id/suspend', async (req, res) => {
    const drv = await db.drivers.update(req.params.id, { status: 'Suspended' });
    res.json(drv);
});
app.post('/api/drivers/:id/activate', async (req, res) => {
    const drv = await db.drivers.update(req.params.id, { status: 'Available' });
    res.json(drv);
});
app.post('/api/drivers/:id/assign-vehicle', async (req, res) => {
    const driverId = req.params.id;
    const { vehicleId } = req.body;
    const drivers = await db.drivers.find();
    for (const d of drivers) {
        if (d.vehicleId === vehicleId && d.id !== driverId) {
            await db.drivers.update(d.id, { vehicleId: null });
        }
    }
    const vehicles = await db.vehicles.find();
    for (const v of vehicles) {
        if (v.driverId === driverId && v.id !== vehicleId) {
            await db.vehicles.update(v.id, { driverId: null });
        }
    }
    await db.drivers.update(driverId, { vehicleId });
    await db.vehicles.update(vehicleId, { driverId });
    res.json({ success: true });
});
app.post('/api/drivers/:id/unassign-vehicle', async (req, res) => {
    const driverId = req.params.id;
    const driver = await db.drivers.findOne(driverId);
    if (driver && driver.vehicleId) {
        await db.vehicles.update(driver.vehicleId, { driverId: null });
        await db.drivers.update(driverId, { vehicleId: null });
    }
    res.json({ success: true });
});

// Orders collection
app.get('/api/orders', async (req, res) => res.json(await db.orders.find()));
app.post('/api/orders', async (req, res) => {
    const order = await db.orders.create(req.body);
    await db.notifications.create({
        title: 'New Order Created',
        message: `Order ${order.id} registered for customer. Quantum optimiser ready.`,
        type: 'Order',
        orderId: order.id
    });
    res.json(order);
});
app.put('/api/orders/:id', async (req, res) => res.json(await db.orders.update(req.params.id, req.body)));
app.delete('/api/orders/:id', async (req, res) => {
    await db.orders.delete(req.params.id);
    res.json({ success: true, message: 'Order deleted' });
});
app.post('/api/orders/reset-delivered', async (req, res) => {
    try {
        const orders = await db.orders.find();
        let count = 0;
        for (const o of orders) {
            if (o.status === 'Completed') {
                await db.orders.update(o.id, {
                    status: 'Pending',
                    quantumStatus: 'Ready',
                    driverId: null,
                    vehicleId: null,
                    actualTimeTakenMinutes: null
                });
                count++;
            }
        }
        await db.notifications.create({
            title: 'Delivered Orders Restored',
            message: `${count} delivered order(s) brought back to undelivered (Pending) state by administrator.`,
            type: 'Order'
        });
        res.json({ success: true, count, message: `Successfully restored ${count} delivered order(s) back to undelivered (Pending) state!` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
});

// Helper to automatically assign order to nearest available driver after a timeout
async function autoAssignOrder(orderId, io) {
    try {
        const order = await db.orders.findOne(orderId);
        if (!order || order.status !== 'Dispatching') return; // Order was already accepted or canceled

        const warehouse = await db.warehouses.findOne(order.warehouseId);
        const customer = await db.customers.findOne(order.customerId);
        if (!warehouse || !customer) return;

        const isSmallDelivery = (order.size || 0) < 100;
        const allDrivers = await db.drivers.find();
        const availableDrivers = [];
        for (const d of allDrivers) {
            if (d.status === 'Available' && d.vehicleId) {
                const vehicle = await db.vehicles.findOne(d.vehicleId);
                const activeTrip = await db.trips.findByDriver(d.id);
                if (vehicle && vehicle.status === 'Available' && !activeTrip) {
                    const isTwoWheeler = vehicle.category === 'Two-Wheeler' || vehicle.capacity <= 200 || d.driverClass === 'Two-Wheeler Driver';
                    if (isSmallDelivery && isTwoWheeler) {
                        availableDrivers.push({ driver: d, vehicle });
                    } else if (!isSmallDelivery && !isTwoWheeler) {
                        availableDrivers.push({ driver: d, vehicle });
                    }
                }
            }
        }

        if (availableDrivers.length === 0) {
            console.warn(`[Auto-Assign] No available drivers with available vehicles found for order ${orderId}`);
            return;
        }

        // Rank available drivers by distance
        const ranked = availableDrivers.map(ad => {
            const distanceToWarehouse = calculateDistance(ad.driver.gps.lat, ad.driver.gps.lng, warehouse.latitude, warehouse.longitude);
            const distanceWarehouseToCustomer = calculateDistance(warehouse.latitude, warehouse.longitude, customer.latitude, customer.longitude);
            const totalDistance = distanceToWarehouse + distanceWarehouseToCustomer;
            return {
                ...ad,
                totalDistance
            };
        }).sort((a, b) => a.totalDistance - b.totalDistance);

        // Pick the closest driver
        const selected = ranked[0];
        const driver = selected.driver;
        const vehicle = selected.vehicle;

        // Update states to locked/delivering
        await db.orders.update(orderId, { status: 'Assigned', driverId: driver.id, vehicleId: vehicle.id, quantumStatus: 'Optimized' });
        await db.drivers.update(driver.id, { status: 'Delivering' });
        await db.vehicles.update(vehicle.id, { status: 'Busy' });

        const nodes = [{
            id: customer.id,
            name: customer.name,
            latitude: customer.latitude,
            longitude: customer.longitude,
            priority: order.priority
        }];

        const traffic = await db.trafficEvents.find();
        const breakdowns = await db.vehicleBreakdowns.find();

        // Solve via Quantum Optimizer (QAOA)
        const quantumSol = solveQuantumHybrid(warehouse, nodes, traffic, breakdowns);
        const expectedDistance = quantumSol.metrics.totalDistance;
        const expectedTime = quantumSol.metrics.totalTimeMinutes;

        // Register Quantum Job log
        const job = await db.quantumJobs.create({
            jobId: `qjob-${Date.now().toString().slice(-6)}`,
            optimizerStatus: 'Solved',
            qubitCount: quantumSol.jobTelemetry.qubits,
            candidateRoutes: 4,
            selectedOptimalRoute: expectedDistance,
            distanceSaved: (expectedDistance * 0.15),
            fuelSaved: quantumSol.metrics.fuelConsumedLiters * 0.15,
            executionTime: 42,
            energyConvergence: quantumSol.jobTelemetry.convergence
        });

        // Generate Turn-by-Turn Road Route
        const routeStops = [
            { latitude: warehouse.latitude, longitude: warehouse.longitude },
            ...quantumSol.route.filter(n => n.type === 'customer'),
            { latitude: warehouse.latitude, longitude: warehouse.longitude }
        ];
        const actualRoadRoute = await getRoadRoute(routeStops);

        // Create active trip
        const trip = await db.trips.create({
            driverId: driver.id,
            vehicleId: vehicle.id,
            warehouseId: warehouse.id,
            orderIds: [orderId],
            status: 'Active',
            expectedDistance,
            expectedTime,
            routeDetails: quantumSol.route,
            roadRoute: actualRoadRoute,
            currentRoadRouteIndex: 0,
            jobId: job.id,
            acceptedAt: new Date().toISOString()
        });

        // Lock orders state
        await db.orders.update(orderId, { status: 'In Transit' });

        // Register notifications
        await db.notifications.create({
            title: 'Auto-Assigned Delivery',
            message: `System Alert: Order ${order.id} was auto-assigned to you as the closest driver.`,
            type: 'Trip',
            driverId: driver.id,
            tripId: trip.id
        });

        // Broadcast to all clients
        io.emit('dispatch:accepted', {
            orderId: order.id,
            driverId: driver.id,
            driverName: driver.name,
            tripId: trip.id,
            autoAssigned: true
        });

        // Notify specific driver deliberately via dedicated alert trigger
        io.to(driver.id).emit('dispatch:auto_assigned_alert', {
            orderId: order.id,
            message: `🚨 System Alert: You have been automatically assigned Order ${order.id} as the nearest available driver. Proceed to delivery immediately.`
        });

        console.log(`[Auto-Assign] Order ${orderId} successfully auto-assigned to ${driver.name} (Timeout Escalation).`);
    } catch (err) {
        console.error(`[Auto-Assign] Failed to auto-assign order ${orderId}:`, err);
    }
}

// Real-Time dispatch notification logic based on driver distance ranking
app.post('/api/orders/:id/start-delivery', async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await db.orders.findOne(orderId);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        await db.orders.update(orderId, { status: 'Dispatching' });

        const warehouse = await db.warehouses.findOne(order.warehouseId);
        const customer = await db.customers.findOne(order.customerId);
        if (!warehouse || !customer) return res.status(404).json({ message: 'Depot or Customer not found for this order.' });

        const isSmallDelivery = (order.size || 0) < 100;
        const allDrivers = await db.drivers.find();
        const availableDrivers = [];
        for (const d of allDrivers) {
            if (d.status === 'Available' && d.vehicleId) {
                const vehicle = await db.vehicles.findOne(d.vehicleId);
                const isTwoWheeler = vehicle?.category === 'Two-Wheeler' || (vehicle && vehicle.capacity <= 200) || d.driverClass === 'Two-Wheeler Driver';
                if (isSmallDelivery && isTwoWheeler) {
                    availableDrivers.push(d);
                } else if (!isSmallDelivery && !isTwoWheeler) {
                    availableDrivers.push(d);
                }
            }
        }

        const rankedDrivers = availableDrivers.map(d => {
            const distanceToWarehouse = calculateDistance(d.gps.lat, d.gps.lng, warehouse.latitude, warehouse.longitude);
            const distanceWarehouseToCustomer = calculateDistance(warehouse.latitude, warehouse.longitude, customer.latitude, customer.longitude);
            const totalDistance = distanceToWarehouse + distanceWarehouseToCustomer;
            
            let priorityLabel = '🔴 Far';
            if (totalDistance <= 3.0) priorityLabel = '🟢 Very Close';
            else if (totalDistance <= 7.0) priorityLabel = '🟡 Near';
            else if (totalDistance <= 15.0) priorityLabel = '🟠 Medium';

            return {
                driverId: d.id,
                name: d.name,
                email: d.email,
                phone: d.phone,
                gps: d.gps,
                warehouseDistance: Number(distanceToWarehouse.toFixed(2)),
                deliveryDistance: Number(distanceWarehouseToCustomer.toFixed(2)),
                totalDistance: Number(totalDistance.toFixed(2)),
                priority: priorityLabel
            };
        }).sort((a, b) => a.totalDistance - b.totalDistance);

        // Notify each driver individually with customized distance and priority label
        const io = req.app.get('io');
        rankedDrivers.forEach((rd, idx) => {
            const rank = idx + 1;
            io.to(rd.driverId).emit('dispatch:notification', {
                orderId: order.id,
                customerName: customer.name,
                warehouseName: warehouse.name,
                pickupAddress: warehouse.address,
                deliveryAddress: customer.address,
                warehouseDistance: rd.warehouseDistance,
                deliveryDistance: rd.deliveryDistance,
                totalDistance: rd.totalDistance,
                priorityLabel: rd.priority,
                rank,
                priority: order.priority,
                size: order.size,
                deadline: order.deadline || 'Immediate'
            });
        });

        // Also broadcast the list of notifications globally to Admin so they can watch live ranking
        io.emit('dispatch:admin_notified', { orderId: order.id, rankedDrivers });

        // Trigger 30 seconds auto-assignment timer
        setTimeout(() => {
            autoAssignOrder(orderId, io);
        }, 30000);

        res.json({ success: true, rankedDrivers });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
});

// Real-Time dispatch acceptance handler (first driver to accept claims the order)
app.post('/api/orders/:id/accept', authenticateToken, async (req, res) => {
    try {
        const orderId = req.params.id;
        const driverId = req.user.id;

        const order = await db.orders.findOne(orderId);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (order.status !== 'Dispatching') {
            return res.status(400).json({ message: 'Delivery already accepted by another driver.' });
        }

        const driver = await db.drivers.findOne(driverId);
        if (!driver) return res.status(404).json({ message: 'Driver not found.' });
        if (driver.status !== 'Available') {
            return res.status(400).json({ message: 'You are not available to accept this order.' });
        }
        if (!driver.vehicleId) {
            return res.status(400).json({ message: 'No vehicle assigned to your profile.' });
        }

        const vehicle = await db.vehicles.findOne(driver.vehicleId);
        if (!vehicle) return res.status(404).json({ message: 'Assigned vehicle not found.' });
        if (vehicle.status !== 'Available') {
            return res.status(400).json({ message: 'Assigned vehicle is not available.' });
        }

        const isSmallDelivery = (order.size || 0) < 100;
        const isTwoWheeler = vehicle.category === 'Two-Wheeler' || vehicle.capacity <= 200 || driver.driverClass === 'Two-Wheeler Driver';

        if (isSmallDelivery && !isTwoWheeler) {
            return res.status(400).json({ message: 'Small deliveries (< 100 kg) are exclusively managed by Two-Wheeler drivers.' });
        }
        if (!isSmallDelivery && isTwoWheeler) {
            return res.status(400).json({ message: 'Heavy deliveries (≥ 100 kg) are exclusively managed by 4-Wheeler drivers.' });
        }

        // Check if driver has any active trips
        const activeTrip = await db.trips.findByDriver(driverId);
        if (activeTrip) {
            return res.status(400).json({ message: 'You already have an active trip assignment.' });
        }

        // Lock order, driver, and vehicle
        await db.orders.update(orderId, { status: 'Assigned', driverId: driver.id, vehicleId: vehicle.id, quantumStatus: 'Optimized' });
        await db.drivers.update(driverId, { status: 'Delivering' });
        await db.vehicles.update(vehicle.id, { status: 'Busy' });

        const warehouse = await db.warehouses.findOne(order.warehouseId);
        const customer = await db.customers.findOne(order.customerId);
        const nodes = [{
            id: customer.id,
            name: customer.name,
            latitude: customer.latitude,
            longitude: customer.longitude,
            priority: order.priority
        }];

        const traffic = await db.trafficEvents.find();
        const breakdowns = await db.vehicleBreakdowns.find();

        // Solve via Quantum Optimizer (QAOA)
        const quantumSol = solveQuantumHybrid(warehouse, nodes, traffic, breakdowns);
        const expectedDistance = quantumSol.metrics.totalDistance;
        const expectedTime = quantumSol.metrics.totalTimeMinutes;

        // Register Quantum Job log
        const job = await db.quantumJobs.create({
            jobId: `qjob-${Date.now().toString().slice(-6)}`,
            optimizerStatus: 'Solved',
            qubitCount: quantumSol.jobTelemetry.qubits,
            candidateRoutes: 4,
            selectedOptimalRoute: expectedDistance,
            distanceSaved: (expectedDistance * 0.15), // Simulated savings
            fuelSaved: quantumSol.metrics.fuelConsumedLiters * 0.15,
            executionTime: 42, // milliseconds
            energyConvergence: quantumSol.jobTelemetry.convergence
        });

        // Generate Turn-by-Turn Road Route
        const routeStops = [
            { latitude: warehouse.latitude, longitude: warehouse.longitude },
            ...quantumSol.route.filter(n => n.type === 'customer'),
            { latitude: warehouse.latitude, longitude: warehouse.longitude }
        ];
        const actualRoadRoute = await getRoadRoute(routeStops);

        // Create active trip
        const trip = await db.trips.create({
            driverId,
            vehicleId: vehicle.id,
            warehouseId: warehouse.id,
            orderIds: [orderId],
            status: 'Active',
            expectedDistance,
            expectedTime,
            routeDetails: quantumSol.route,
            roadRoute: actualRoadRoute,
            currentRoadRouteIndex: 0,
            jobId: job.id,
            acceptedAt: new Date().toISOString()
        });

        // Lock orders state
        await db.orders.update(orderId, { status: 'In Transit' });

        // Notify driver
        await db.notifications.create({
            title: 'Trip Accepted & Started',
            message: `Delivery accepted: ${warehouse.name} -> ${customer.name}. expected time ${expectedTime} mins.`,
            type: 'Trip',
            driverId,
            tripId: trip.id
        });

        // Broadcast Socket event globally
        const io = req.app.get('io');
        io.emit('dispatch:accepted', {
            orderId: order.id,
            driverId: driver.id,
            driverName: driver.name,
            tripId: trip.id
        });

        res.json({ success: true, trip, job });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
});

// Admin toggle SOS zone for traffic obstacles
app.post('/api/events/traffic/:id/toggle-sos', async (req, res) => {
    try {
        const id = req.params.id;
        const allTraffic = await db.trafficEvents.find();
        const event = allTraffic.find(t => t.id === id);
        if (!event) return res.status(404).json({ message: 'Traffic block not found.' });

        const updatedEvent = await db.trafficEvents.update(id, { 
            isSOSZone: !event.isSOSZone, 
            isActive: true 
        });

        const io = req.app.get('io');
        io.emit('events:sos_updated', updatedEvent);

        res.json(updatedEvent);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
});


// Trips collection
app.get('/api/trips', async (req, res) => res.json(await db.trips.find()));

// --- NOTIFICATION HANDLERS ---
app.get('/api/notifications', async (req, res) => {
    res.json(await db.notifications.find());
});
app.post('/api/notifications/read', async (req, res) => {
    await db.notifications.markAllRead();
    res.json({ success: true });
});

// --- QUANTUM OPTIMIZER ENDPOINTS ---
// --- QUANTUM OPTIMIZER ENDPOINTS ---
app.get('/api/quantum/compare', async (req, res) => {
    const { warehouseId, vehicleId } = req.query;
    if (!warehouseId || !vehicleId) {
        return res.status(400).json({ message: 'Missing parameters' });
    }

    const warehouse = await db.warehouses.findOne(warehouseId);
    const vehicle = await db.vehicles.findOne(vehicleId);
    if (!warehouse || !vehicle) {
        return res.status(404).json({ message: 'Depot or vehicle carrier not found' });
    }

    // Get orders assigned to vehicle carrier
    const allOrders = await db.orders.find();
    const orders = allOrders.filter(o => o.vehicleId === vehicleId && o.status !== 'Completed');
    if (orders.length === 0) {
        return res.json({
            classical: { route: [], metrics: { totalDistance: 0, totalTimeMinutes: 0, fuelConsumedLiters: 0, co2EmissionKg: 0, costRupees: 0 } },
            quantum: { route: [], metrics: { totalDistance: 0, totalTimeMinutes: 0, fuelConsumedLiters: 0, co2EmissionKg: 0, costRupees: 0 } }
        });
    }

    const customerNodes = [];
    for (const o of orders) {
        const cust = await db.customers.findOne(o.customerId);
        if (cust) {
            customerNodes.push({
                id: cust.id,
                name: cust.name,
                latitude: cust.latitude,
                longitude: cust.longitude,
                priority: cust.priority || o.priority
            });
        }
    }

    const traffic = await db.trafficEvents.find();
    const breakdowns = await db.vehicleBreakdowns.find();

    const classical = solveClassical(warehouse, customerNodes, traffic);
    const quantum = solveQuantumHybrid(warehouse, customerNodes, traffic, breakdowns);

    const quantumStops = [
        { latitude: warehouse.latitude, longitude: warehouse.longitude },
        ...quantum.route.filter(n => n.type === 'customer'),
        { latitude: warehouse.latitude, longitude: warehouse.longitude }
    ];
    const quantumRoadRoute = await getRoadRoute(quantumStops);

    const classicalStops = [
        { latitude: warehouse.latitude, longitude: warehouse.longitude },
        ...classical.route.filter(n => n.type === 'customer'),
        { latitude: warehouse.latitude, longitude: warehouse.longitude }
    ];
    const classicalRoadRoute = await getRoadRoute(classicalStops);

    res.json({
        classical: { ...classical, roadRoute: classicalRoadRoute },
        quantum: { ...quantum, roadRoute: quantumRoadRoute }
    });
});

// --- DRIVER ASSIGNED WORKFLOW TRIP ASSIGNATION ---
app.post('/api/trips/assign', async (req, res) => {
    const { driverId, vehicleId, warehouseId, orderIds, overrideRules } = req.body;
    if (!driverId || !vehicleId || !warehouseId || !orderIds || orderIds.length === 0) {
        return res.status(400).json({ message: 'Payload missing required details' });
    }

    const warehouse = await db.warehouses.findOne(warehouseId);
    const vehicle = await db.vehicles.findOne(vehicleId);
    const driver = await db.drivers.findOne(driverId);
    if (!warehouse || !vehicle || !driver) return res.status(404).json({ message: 'Assets not found' });

    // Validate rules unless overridden
    if (!overrideRules) {
        if (driver.status === 'Suspended') {
            return res.status(400).json({ message: 'Assignment Error: Driver is currently Suspended.' });
        }
        if (driver.status === 'Offline') {
            return res.status(400).json({ message: 'Assignment Error: Driver is currently Offline.' });
        }
        if (driver.status === 'Assigned' || driver.status === 'Delivering' || driver.status === 'Busy') {
            return res.status(400).json({ message: 'Assignment Error: Driver has an active delivery assignment.' });
        }
        if (vehicle.status === 'Busy' || vehicle.status === 'Assigned' || vehicle.maintenanceStatus === 'Broken') {
            return res.status(400).json({ message: 'Assignment Error: Vehicle is currently busy or broken.' });
        }
        if (warehouse.status === 'Inactive') {
            return res.status(400).json({ message: 'Assignment Error: Warehouse depot is Inactive.' });
        }
        for (const oid of orderIds) {
            const ord = await db.orders.findOne(oid);
            if (ord && ord.status !== 'Pending') {
                return res.status(400).json({ message: `Assignment Error: Order ${oid} is already assigned/completed.` });
            }
        }
    }

    // Compile customer nodes
    const nodes = [];
    for (const oid of orderIds) {
        const ord = await db.orders.findOne(oid);
        if (ord) {
            const cust = await db.customers.findOne(ord.customerId);
            if (cust) {
                nodes.push({
                    id: cust.id,
                    name: cust.name,
                    latitude: cust.latitude,
                    longitude: cust.longitude,
                    priority: ord.priority
                });
            }
        }
    }

    const traffic = await db.trafficEvents.find();
    const breakdowns = await db.vehicleBreakdowns.find();

    // Solve via Quantum Optimizer (QAOA)
    const quantumSol = solveQuantumHybrid(warehouse, nodes, traffic, breakdowns);
    const expectedDistance = quantumSol.metrics.totalDistance;
    const expectedTime = quantumSol.metrics.totalTimeMinutes;

    // Register Quantum Job log
    const job = await db.quantumJobs.create({
        jobId: `qjob-${Date.now().toString().slice(-6)}`,
        optimizerStatus: 'Solved',
        qubitCount: quantumSol.jobTelemetry.qubits,
        candidateRoutes: 4,
        selectedOptimalRoute: expectedDistance,
        distanceSaved: (expectedDistance * 0.15), // Simulated savings
        fuelSaved: quantumSol.metrics.fuelConsumedLiters * 0.15,
        executionTime: 42, // milliseconds
        energyConvergence: quantumSol.jobTelemetry.convergence
    });

    // Generate Turn-by-Turn Road Route
    const routeStops = [
        { latitude: warehouse.latitude, longitude: warehouse.longitude },
        ...quantumSol.route.filter(n => n.type === 'customer'),
        { latitude: warehouse.latitude, longitude: warehouse.longitude }
    ];
    const actualRoadRoute = await getRoadRoute(routeStops);

    // Create active trip
    const trip = await db.trips.create({
        driverId,
        vehicleId,
        warehouseId,
        orderIds,
        status: 'Assigned',
        expectedDistance,
        expectedTime,
        routeDetails: quantumSol.route,
        roadRoute: actualRoadRoute,
        currentRoadRouteIndex: 0,
        jobId: job.id
    });

    // Lock orders, driver and vehicle status
    for (const oid of orderIds) {
        await db.orders.update(oid, { status: 'Assigned', quantumStatus: 'Optimized', driverId, vehicleId });
    }
    await db.drivers.update(driverId, { status: 'Assigned' });
    await db.vehicles.update(vehicleId, { status: 'Assigned' });

    // Notify driver
    await db.notifications.create({
        title: 'New Trip Assigned',
        message: `Delivery assigned: ${warehouse.name} -> ${nodes.length} destinations. expected time ${expectedTime} mins.`,
        type: 'Trip',
        driverId,
        tripId: trip.id
    });

    res.json({ trip, job });
});

// Fetch current active assigned trip for logged-in driver
app.get('/api/driver/trip', authenticateToken, async (req, res) => {
    const trip = await db.trips.findByDriver(req.user.id);
    if (!trip) return res.json(null);

    const vehicle = await db.vehicles.findOne(trip.vehicleId);
    const warehouse = await db.warehouses.findOne(trip.warehouseId);
    const ordersList = [];
    for (const oid of trip.orderIds) {
        const o = await db.orders.findOne(oid);
        if (o) {
            const cust = await db.customers.findOne(o.customerId);
            ordersList.push({ ...(o.toObject ? o.toObject() : o), customer: cust });
        }
    }

    res.json({ trip, vehicle, warehouse, orders: ordersList });
});

// Respond to trip prompt (Accept / Reject)
app.post('/api/driver/trip/respond', authenticateToken, async (req, res) => {
    const { tripId, action } = req.body; // 'accept' or 'reject'
    const trip = await db.trips.findOne(tripId);
    if (!trip) return res.status(404).json({ message: 'Trip assignment not found' });

    if (action === 'accept') {
        await db.trips.update(tripId, { status: 'Active', acceptedAt: new Date().toISOString() });
        await db.drivers.update(req.user.id, { status: 'Delivering' });
        await db.vehicles.update(trip.vehicleId, { status: 'Busy' });
        for (const oid of trip.orderIds) {
            await db.orders.update(oid, { status: 'In Transit' });
        }

        await db.notifications.create({
            title: 'Trip Accepted',
            message: `Driver ${req.user.name} accepted Trip ${tripId}. Dispatch locked.`,
            type: 'Trip',
            driverId: req.user.id
        });
        return res.json({ success: true, status: 'Active' });
    } else {
        // Reject Route
        await db.trips.update(tripId, { status: 'Rejected', rejectedAt: new Date().toISOString() });
        await db.drivers.update(req.user.id, { status: 'Available' });
        await db.vehicles.update(trip.vehicleId, { status: 'Available' });
        for (const oid of trip.orderIds) {
            await db.orders.update(oid, { status: 'Pending', quantumStatus: 'Ready', driverId: null, vehicleId: null });
        }

        await db.notifications.create({
            title: 'Trip Rejected',
            message: `Driver ${req.user.name} rejected Assignment Trip ${tripId}. Please re-allocate.`,
            type: 'Alert',
            driverId: req.user.id
        });
        return res.json({ success: true, status: 'Rejected' });
    }
});

// Complete single delivery manifest node
app.post('/api/driver/trip/complete-node', authenticateToken, async (req, res) => {
    const { orderId } = req.body;
    const order = await db.orders.findOne(orderId);
    if (!order) return res.status(404).json({ message: 'Order node not found' });

    // Calculate simulated actual delivery duration
    const activeTrip = await db.trips.findByDriver(req.user.id);
    let timeTaken = 15.5;
    if (activeTrip) {
        timeTaken = Number(((activeTrip.expectedTime / activeTrip.orderIds.length) * (0.85 + Math.random() * 0.2)).toFixed(1));
    }

    await db.orders.update(orderId, { 
        status: 'Completed',
        actualTimeTakenMinutes: timeTaken
    });

    // Set driver current GPS to customer location
    const cust = await db.customers.findOne(order.customerId);
    if (cust) {
        await db.drivers.update(req.user.id, { gps: { lat: cust.latitude, lng: cust.longitude } });
        await db.vehicles.update(order.vehicleId, { latitude: cust.latitude, longitude: cust.longitude });
    }

    // Check if all orders in driver's active trip are completed
    if (activeTrip) {
        const totalOrderObjects = [];
        for (const oid of activeTrip.orderIds) {
            const o = await db.orders.findOne(oid);
            if (o) totalOrderObjects.push(o);
        }
        const pendingCount = totalOrderObjects.filter(o => o.status !== 'Completed').length;
        if (pendingCount === 0) {
            const tripTimeTaken = Number((activeTrip.expectedTime * (0.85 + Math.random() * 0.2)).toFixed(1));
            await db.trips.update(activeTrip.id, { 
                status: 'Completed',
                actualTimeTakenMinutes: tripTimeTaken
            });
            await db.drivers.update(req.user.id, { status: 'Available' });
            await db.vehicles.update(activeTrip.vehicleId, { status: 'Available' });
        }
    }

    await db.notifications.create({
        title: 'Order Completed',
        message: `Delivery completed successfully to customer ${cust?.name || ''}.`,
        type: 'Order',
        orderId
    });

    res.json({ success: true });
});

// SOS Breakdown reporter
app.post('/api/driver/trip/breakdown', authenticateToken, async (req, res) => {
    try {
        const { tripId, description } = req.body;
        const trip = await db.trips.findOne(tripId);
        if (!trip) return res.status(404).json({ message: 'Trip not found' });

        await db.trips.update(tripId, { status: 'Failed' });
        
        const driver = await db.drivers.findOne(req.user.id);
        await db.drivers.update(req.user.id, { status: 'Suspended' }); // Distress/emergency indicator
        await db.vehicles.update(trip.vehicleId, { status: 'Breakdown', maintenanceStatus: 'Broken' });

        // Mitigate/Re-route remaining order nodes
        const unresolvedOids = [];
        let firstOrder = null;
        for (const oid of trip.orderIds) {
            const ord = await db.orders.findOne(oid);
            if (ord && ord.status !== 'Completed') {
                unresolvedOids.push(oid);
                if (!firstOrder) firstOrder = ord;
            }
        }

        if (unresolvedOids.length === 0) {
            return res.json({ success: true, message: 'Breakdown logged. No pending orders to recover.' });
        }

        // Determine current delivery stage based on route nodes
        let deliveryStage = 'Package Loaded';
        if (trip.currentRoadRouteIndex > 0) {
            deliveryStage = trip.currentRoadRouteIndex >= (trip.routeDetails.length / 2) ? 'Halfway' : 'Warehouse Picked';
        }

        // Raise breakdown event
        const breakdown = await db.vehicleBreakdowns.create({
            vehicleId: trip.vehicleId,
            tripId,
            driverId: req.user.id,
            latitude: driver.gps.lat,
            longitude: driver.gps.lng,
            description: description || 'Mechanical breakdown reported.',
            severity: 'High',
            status: 'Active',
            orderStatus: deliveryStage
        });

        await db.notifications.create({
            title: 'Vehicle Breakdown Critical!',
            message: `Vehicle ${trip.vehicleId} reported breakdown. Recovery dispatch initiated.`,
            type: 'Alert',
            orderId: unresolvedOids[0]
        });

        // Find available drivers for recovery notification
        const allDrivers = await db.drivers.find();
        const availableDrivers = allDrivers.filter(d => d.status === 'Available');

        if (firstOrder) {
            const customer = await db.customers.findOne(firstOrder.customerId);
            const warehouse = await db.warehouses.findOne(firstOrder.warehouseId);

            const rankedRecoveryDrivers = availableDrivers.map(d => {
                const distanceToBreakdown = calculateDistance(d.gps.lat, d.gps.lng, driver.gps.lat, driver.gps.lng);
                const remainingDistance = calculateDistance(driver.gps.lat, driver.gps.lng, customer.latitude, customer.longitude);
                const totalDistance = distanceToBreakdown + remainingDistance;

                let priorityLabel = '🔴 Far';
                if (totalDistance <= 3.0) priorityLabel = '🟢 Very Close';
                else if (totalDistance <= 7.0) priorityLabel = '🟡 Near';
                else if (totalDistance <= 15.0) priorityLabel = '🟠 Medium';

                return {
                    driverId: d.id,
                    name: d.name,
                    distanceToBreakdown: Number(distanceToBreakdown.toFixed(2)),
                    remainingDistance: Number(remainingDistance.toFixed(2)),
                    totalDistance: Number(totalDistance.toFixed(2)),
                    priority: priorityLabel
                };
            }).sort((a, b) => a.totalDistance - b.totalDistance);

            // Broadcast recovery notifications via Socket.IO
            const io = req.app.get('io');
            rankedRecoveryDrivers.forEach(rd => {
                io.to(rd.driverId).emit('dispatch:recovery_notification', {
                    breakdownId: breakdown.id,
                    originalDriverName: driver.name,
                    breakdownLocation: driver.gps,
                    orderStatus: deliveryStage,
                    customerName: customer.name,
                    warehouseName: warehouse.name,
                    distanceToBreakdown: rd.distanceToBreakdown,
                    remainingDistance: rd.remainingDistance,
                    totalDistance: rd.totalDistance,
                    priorityLabel: rd.priority
                });
            });

            // Sync globally to admin
            io.emit('dispatch:recovery_admin_notified', { breakdownId: breakdown.id, rankedRecoveryDrivers });
        }

        res.json({ success: true, message: 'Breakdown logged. Recovery dispatch triggered.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
});

// SOS Recovery delivery acceptance endpoint
app.post('/api/breakdowns/:id/accept', authenticateToken, async (req, res) => {
    try {
        const breakdownId = req.params.id;
        const driverId = req.user.id;

        const breakdown = await db.vehicleBreakdowns.findOne(breakdownId);
        if (!breakdown) return res.status(404).json({ message: 'Breakdown record not found' });
        if (breakdown.status !== 'Active') return res.status(400).json({ message: 'This recovery has already been completed or resolved.' });

        const driver = await db.drivers.findOne(driverId);
        if (!driver) return res.status(404).json({ message: 'Driver not found.' });
        if (driver.status !== 'Available') return res.status(400).json({ message: 'You are not available.' });
        if (!driver.vehicleId) return res.status(400).json({ message: 'No vehicle assigned to your profile.' });

        const vehicle = await db.vehicles.findOne(driver.vehicleId);
        if (!vehicle || vehicle.status !== 'Available') return res.status(400).json({ message: 'Vehicle is not available.' });

        const oldTrip = await db.trips.findOne(breakdown.tripId);
        if (!oldTrip) return res.status(404).json({ message: 'Original trip not found.' });

        // Resolve breakdown and release old driver to Available
        await db.vehicleBreakdowns.update(breakdownId, { status: 'Resolved' });
        await db.vehicles.update(breakdown.vehicleId, { status: 'Maintenance' });
        await db.drivers.update(breakdown.driverId, { status: 'Available' });

        // Lock new driver and new vehicle
        await db.drivers.update(driverId, { status: 'Delivering' });
        await db.vehicles.update(vehicle.id, { status: 'Busy' });

        // Migrate remaining order nodes to the new driver & vehicle
        const unresolvedOids = [];
        for (const oid of oldTrip.orderIds) {
            const ord = await db.orders.findOne(oid);
            if (ord && ord.status !== 'Completed') {
                unresolvedOids.push(oid);
                await db.orders.update(oid, { driverId, vehicleId: vehicle.id, status: 'Assigned' });
            }
        }

        if (unresolvedOids.length === 0) {
            return res.status(400).json({ message: 'No unresolved orders on this trip.' });
        }

        // Calculate recovery route: New Driver Location -> Breakdown Coordinates -> Customer -> Depot
        const warehouse = await db.warehouses.findOne(oldTrip.warehouseId);
        const order = await db.orders.findOne(unresolvedOids[0]);
        const customer = await db.customers.findOne(order.customerId);

        const nodes = [
            { id: 'breakdown-node', name: 'Breakdown Spot', latitude: breakdown.latitude, longitude: breakdown.longitude, priority: 'High' },
            { id: customer.id, name: customer.name, latitude: customer.latitude, longitude: customer.longitude, priority: order.priority }
        ];

        const traffic = await db.trafficEvents.find();
        const breakdowns = await db.vehicleBreakdowns.find();

        const quantumSol = solveQuantumHybrid(warehouse, nodes, traffic, breakdowns);

        // Build route details containing recovery stop
        const routeStops = [
            { latitude: driver.gps.lat, longitude: driver.gps.lng },
            { latitude: breakdown.latitude, longitude: breakdown.longitude },
            { latitude: customer.latitude, longitude: customer.longitude },
            { latitude: warehouse.latitude, longitude: warehouse.longitude }
        ];
        const actualRoadRoute = await getRoadRoute(routeStops);

        const newTrip = await db.trips.create({
            driverId,
            vehicleId: vehicle.id,
            warehouseId: warehouse.id,
            orderIds: unresolvedOids,
            status: 'Active',
            expectedDistance: quantumSol.metrics.totalDistance,
            expectedTime: quantumSol.metrics.totalTimeMinutes,
            routeDetails: quantumSol.route,
            roadRoute: actualRoadRoute,
            currentRoadRouteIndex: 0
        });

        // Set orders status to transit
        for (const oid of unresolvedOids) {
            await db.orders.update(oid, { status: 'In Transit' });
        }

        await db.notifications.create({
            title: 'Recovery Accepted',
            message: `Driver ${driver.name} took over breakdown recovery.`,
            type: 'Trip',
            driverId,
            tripId: newTrip.id
        });

        // Socket broadcast
        const io = req.app.get('io');
        io.emit('dispatch:recovery_accepted', {
            breakdownId,
            driverId,
            driverName: driver.name,
            tripId: newTrip.id
        });

        res.json({ success: true, trip: newTrip });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
});

// GET breakdowns list
app.get('/api/breakdowns', async (req, res) => {
    try {
        res.json(await db.vehicleBreakdowns.find());
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Admin endpoint to resolve breakdown and restore vehicle/driver to available state
app.post('/api/breakdowns/:id/resolve-admin', async (req, res) => {
    try {
        const breakdownId = req.params.id;
        const breakdown = await db.vehicleBreakdowns.findOne(breakdownId);
        if (!breakdown) return res.status(404).json({ message: 'Breakdown record not found' });
        
        await db.vehicleBreakdowns.update(breakdownId, { status: 'Resolved' });
        await db.vehicles.update(breakdown.vehicleId, { status: 'Available', maintenanceStatus: 'Normal' });
        if (breakdown.driverId) {
            await db.drivers.update(breakdown.driverId, { status: 'Available' });
        }
        
        const io = req.app.get('io');
        io.emit('dispatch:recovery_accepted', { breakdownId }); // Refresh dashboards
        
        res.json({ success: true, message: 'Vehicle brought back to life successfully!' });
    } catch (e) {
        console.error("Error resolving breakdown:", e);
        res.status(500).json({ message: e.message });
    }
});

// Admin endpoint to restore a specific vehicle asset to live available state
app.post('/api/vehicles/:id/restore', async (req, res) => {
    try {
        const vehicleId = req.params.id;
        const vehicle = await db.vehicles.findOne(vehicleId);
        if (!vehicle) return res.status(404).json({ message: 'Vehicle asset not found' });

        await db.vehicles.update(vehicleId, { status: 'Available', maintenanceStatus: 'Normal' });

        // Resolve any active breakdowns associated with this vehicle
        const breakdowns = await db.vehicleBreakdowns.find();
        const activeBrks = breakdowns.filter(b => b.vehicleId === vehicleId && b.status === 'Active');
        for (const b of activeBrks) {
            await db.vehicleBreakdowns.update(b.id, { status: 'Resolved' });
            if (b.driverId) {
                await db.drivers.update(b.driverId, { status: 'Available' });
            }
        }

        if (vehicle.driverId) {
            const driver = await db.drivers.findOne(vehicle.driverId);
            if (driver && (driver.status === 'Suspended' || driver.status === 'Maintenance')) {
                await db.drivers.update(driver.id, { status: 'Available' });
            }
        }

        const io = req.app.get('io');
        io.emit('dispatch:recovery_accepted', { vehicleId });

        res.json({ success: true, message: 'Vehicle restored to live service successfully!' });
    } catch (e) {
        console.error("Error restoring vehicle:", e);
        res.status(500).json({ message: e.message });
    }
});

// Update driver current location or speed
app.post('/api/driver/location', authenticateToken, async (req, res) => {
    const { lat, lng, speed, battery, network } = req.body;
    await db.drivers.update(req.user.id, {
        gps: { lat, lng },
        currentSpeed: speed || 0,
        batteryLevel: battery || 80,
        networkStatus: network || 'Good',
        updatedAt: new Date().toISOString()
    });

    // Also sync vehicle coordinates if active
    const vehicle = await db.vehicles.findByDriver(req.user.id);
    if (vehicle) {
        await db.vehicles.update(vehicle.id, { latitude: lat, longitude: lng });
    }

    const io = req.app.get('io');
    io.emit('driver:location_update', {
        driverId: req.user.id,
        gps: { lat, lng },
        speed: speed || 0,
        batteryLevel: battery || 80,
        networkStatus: network || 'Good'
    });

    res.json({ success: true });
});

app.get('/api/events/traffic', async (req, res) => res.json(await db.trafficEvents.find()));

// Dynamic traffic obstacle trigger
app.post('/api/events/traffic', async (req, res) => {
    const { latitude, longitude, severity, description } = req.body;
    const evt = await db.trafficEvents.create({ latitude, longitude, severity, description });
    await db.notifications.create({
        title: 'Traffic Block Registered',
        message: `Traffic congestion alert: ${description || 'high delays'}. Quantum optimizer rerouting active.`,
        type: 'Alert'
    });
    res.json(evt);
});

// Clear events
app.post('/api/events/clear', async (req, res) => {
    await db.trafficEvents.clear();
    await db.vehicleBreakdowns.clear();
    const vehiclesList = await db.vehicles.find();
    for (const v of vehiclesList) {
        if (v.status === 'Under Maintenance') {
            await db.vehicles.update(v.id, { status: 'Available', maintenanceStatus: 'Normal' });
        }
    }
    res.json({ success: true });
});

// Database statistics API
app.get('/api/reports/kpis', async (req, res) => {
    const orders = await db.orders.find();
    const trips = await db.trips.find();
    const vehicles = await db.vehicles.find();
    const drivers = await db.drivers.find();
    const jobs = await db.quantumJobs.find();

    res.json({
        kpis: {
            todayOrders: orders.length,
            pendingOrders: orders.filter(o => o.status === 'Pending' || o.status === 'Assigned' || o.status === 'In Transit').length,
            completedOrders: orders.filter(o => o.status === 'Completed').length,
            cancelledOrders: orders.filter(o => o.status === 'Rejected').length
        },
        fleet: {
            available: vehicles.filter(v => v.status === 'Available').length,
            active: vehicles.filter(v => v.status === 'Busy' || v.status === 'Assigned').length,
            maintenance: vehicles.filter(v => v.status === 'Under Maintenance').length,
            onlineDrivers: drivers.filter(d => d.status !== 'Offline' && d.status !== 'Suspended').length,
            offlineDrivers: drivers.filter(d => d.status === 'Offline' || d.status === 'Suspended').length
        },
        quantum: {
            jobsRunning: trips.filter(t => t.status === 'Active').length,
            jobsCompleted: jobs.length,
            avgOptimizationTime: 45, // ms
            distanceSaved: jobs.length > 0 ? Number(jobs.reduce((acc, j) => acc + j.distanceSaved, 0).toFixed(1)) : 0
        }
    });
});

// Admin Controllers
app.post('/api/trips/:id/cancel', async (req, res) => {
    const trip = await db.trips.findOne(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    await db.trips.update(trip.id, { status: 'Cancelled' });
    await db.drivers.update(trip.driverId, { status: 'Available' });
    await db.vehicles.update(trip.vehicleId, { status: 'Available' });
    
    for (const oid of trip.orderIds) {
        await db.orders.update(oid, { status: 'Pending', quantumStatus: 'Ready', driverId: null, vehicleId: null });
    }

    await db.notifications.create({
        title: 'Trip Cancelled By Admin',
        message: `Trip ${trip.id} was manually cancelled by administrator override.`,
        type: 'Alert'
    });

    res.json({ success: true });
});

app.post('/api/trips/:id/reassign', async (req, res) => {
    const trip = await db.trips.findOne(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    if (trip.status !== 'Assigned') {
        return res.status(400).json({ message: 'Cannot reassign trip once in progress.' });
    }

    const { newDriverId, newVehicleId } = req.body;

    // Release old
    await db.drivers.update(trip.driverId, { status: 'Available' });
    await db.vehicles.update(trip.vehicleId, { status: 'Available' });

    // Lock new
    await db.drivers.update(newDriverId, { status: 'Assigned' });
    await db.vehicles.update(newVehicleId, { status: 'Assigned' });

    for (const oid of trip.orderIds) {
        await db.orders.update(oid, { driverId: newDriverId, vehicleId: newVehicleId });
    }

    await db.trips.update(trip.id, { driverId: newDriverId, vehicleId: newVehicleId });

    await db.notifications.create({
        title: 'Trip Reassigned',
        message: `Trip ${trip.id} reassigned to driver ${newDriverId} / vehicle ${newVehicleId}.`,
        type: 'Trip',
        driverId: newDriverId
    });

    res.json({ success: true });
});

app.post('/api/trips/:id/pause', async (req, res) => {
    const trip = await db.trips.findOne(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    await db.trips.update(trip.id, { isPaused: true });
    
    await db.notifications.create({
        title: 'Trip Paused',
        message: `Delivery trip ${trip.id} paused by administrator.`,
        type: 'Alert'
    });

    res.json({ success: true });
});

app.post('/api/trips/:id/resume', async (req, res) => {
    const trip = await db.trips.findOne(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found' });

    await db.trips.update(trip.id, { isPaused: false });
    
    await db.notifications.create({
        title: 'Trip Resumed',
        message: `Delivery trip ${trip.id} resumed by administrator.`,
        type: 'Trip'
    });

    res.json({ success: true });
});

app.post('/api/drivers/:id/emergency', async (req, res) => {
    const { message } = req.body;
    await db.notifications.create({
        title: '🚨 EMERGENCY ALERT',
        message: message || 'Critical priority dispatch update. Contact admin backoffice immediately!',
        type: 'Alert',
        driverId: req.params.id
    });
    res.json({ success: true });
});

app.post('/api/drivers/:id/contact', async (req, res) => {
    const { message } = req.body;
    await db.notifications.create({
        title: 'Dispatcher Message',
        message: message || 'Please contact dispatch office.',
        type: 'System',
        driverId: req.params.id
    });
    res.json({ success: true });
});

// Simulation coordinate progression tick helper
async function simulateTick() {
    const allTrips = await db.trips.find();
    const trips = allTrips.filter(t => t.status === 'Active');
    for (const t of trips) {
        if (t.isPaused) continue;

        const roadRoute = t.roadRoute || [];
        if (roadRoute.length === 0) continue;

        let currentIndex = t.currentRoadRouteIndex || 0;
        currentIndex += 2; // Advance faster

        if (currentIndex >= roadRoute.length) {
            // Completed the entire trip
            const tripTimeTaken = Number((t.expectedTime * (0.85 + Math.random() * 0.2)).toFixed(1));
            await db.trips.update(t.id, { 
                status: 'Completed', 
                currentRoadRouteIndex: roadRoute.length - 1,
                actualTimeTakenMinutes: tripTimeTaken
            });
            await db.drivers.update(t.driverId, { status: 'Available' });
            await db.vehicles.update(t.vehicleId, { status: 'Available' });

            for (const oid of t.orderIds) {
                const ord = await db.orders.findOne(oid);
                if (ord && ord.status !== 'Completed') {
                    const orderTimeTaken = Number(((t.expectedTime / t.orderIds.length) * (0.85 + Math.random() * 0.2)).toFixed(1));
                    await db.orders.update(oid, { 
                        status: 'Completed',
                        actualTimeTakenMinutes: orderTimeTaken
                    });
                    await db.notifications.create({
                        title: 'Package Delivered',
                        message: `Order ${oid} successfully delivered to customer in ${orderTimeTaken} mins.`,
                        type: 'Order',
                        orderId: oid
                    });
                }
            }
            continue;
        }

        // Update driver/vehicle position
        const currentPos = roadRoute[currentIndex];
        await db.trips.update(t.id, { currentRoadRouteIndex: currentIndex });
        
        const drv = await db.drivers.findOne(t.driverId);
        if (drv) {
            await db.drivers.update(t.driverId, {
                gps: { lat: currentPos.latitude, lng: currentPos.longitude },
                currentSpeed: Math.floor(35 + Math.random() * 15),
                batteryLevel: Math.max(20, (drv.batteryLevel || 100) - (Math.random() > 0.8 ? 1 : 0)),
                updatedAt: new Date().toISOString()
            });
        }
        
        await db.vehicles.update(t.vehicleId, {
            latitude: currentPos.latitude,
            longitude: currentPos.longitude
        });

        // Check if we are near any customer stop in the trip to complete its node
        const activeOrders = [];
        for (const oid of t.orderIds) {
            const o = await db.orders.findOne(oid);
            if (o && o.status !== 'Completed') {
                activeOrders.push(o);
            }
        }
        if (activeOrders.length > 0) {
            const nextOrder = activeOrders[0];
            const customer = await db.customers.findOne(nextOrder.customerId);
            if (customer) {
                const distToCust = calculateDistance(currentPos.latitude, currentPos.longitude, customer.latitude, customer.longitude);
                if (distToCust < 0.08) { // within 80 meters
                    const orderTimeTaken = Number(((t.expectedTime / t.orderIds.length) * (0.85 + Math.random() * 0.2)).toFixed(1));
                    await db.orders.update(nextOrder.id, { 
                        status: 'Completed',
                        actualTimeTakenMinutes: orderTimeTaken
                      });
                    await db.notifications.create({
                        title: 'Package Delivered',
                        message: `Carrier completed delivery to customer ${customer.name} in ${orderTimeTaken} mins.`,
                        type: 'Order',
                        orderId: nextOrder.id
                    });
                }
            }
        }
    }
}

// Simulation coordinate progression tick API
app.post('/api/simulation/tick', async (req, res) => {
    await simulateTick();
    res.json({ success: true });
});

// Setup background automated ticker (1 second continuous updates)
setInterval(async () => {
    try {
        await simulateTick();
    } catch (e) {
        console.error("Simulation tick error:", e);
    }
}, 1000);

// App reset
app.post('/api/reports/reset', async (req, res) => {
    await db.reset();
    res.json({ success: true });
});

server.listen(PORT, () => {
    console.log(`SmartRoute Quantum Enterprise Server running on port ${PORT}`);
});
