import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { solveClassical, solveHybridQuantum } from './optimizer.js';

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'smartroute_secret_key_123';

app.use(cors());
app.use(express.json());

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

// --- AUTH ROUTES ---
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.users.findOne({ email, password });
    if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
    const user = db.users.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// --- WAREHOUSE ROUTES ---
app.get('/api/warehouses', (req, res) => res.json(db.warehouses.find()));
app.post('/api/warehouses', (req, res) => res.json(db.warehouses.create(req.body)));
app.put('/api/warehouses/:id', (req, res) => res.json(db.warehouses.update(req.params.id, req.body)));
app.delete('/api/warehouses/:id', (req, res) => res.json(db.warehouses.delete(req.params.id)));

// --- DRIVER ROUTES ---
app.get('/api/drivers', (req, res) => res.json(db.drivers.find()));

// --- VEHICLE ROUTES ---
app.get('/api/vehicles', (req, res) => res.json(db.vehicles.find()));
app.post('/api/vehicles', (req, res) => res.json(db.vehicles.create(req.body)));
app.put('/api/vehicles/:id', (req, res) => res.json(db.vehicles.update(req.params.id, req.body)));
app.delete('/api/vehicles/:id', (req, res) => res.json(db.vehicles.delete(req.params.id)));

// --- CUSTOMER ROUTES ---
app.get('/api/customers', (req, res) => res.json(db.customers.find()));
app.post('/api/customers', (req, res) => res.json(db.customers.create(req.body)));
app.put('/api/customers/:id', (req, res) => res.json(db.customers.update(req.params.id, req.body)));
app.delete('/api/customers/:id', (req, res) => res.json(db.customers.delete(req.params.id)));

// --- ORDER ROUTES ---
app.get('/api/orders', (req, res) => res.json(db.orders.find()));
app.post('/api/orders', (req, res) => res.json(db.orders.create(req.body)));
app.put('/api/orders/:id', (req, res) => res.json(db.orders.update(req.params.id, req.body)));
app.delete('/api/orders/:id', (req, res) => res.json(db.orders.delete(req.params.id)));

// Get driver-specific assignment details
app.get('/api/driver/route', authenticateToken, (req, res) => {
    const driverId = req.user.id;
    const vehicle = db.vehicles.findByDriver(driverId);
    if (!vehicle) return res.status(404).json({ message: 'No vehicle assigned to this driver' });
    const orders = db.orders.findByVehicle(vehicle.id);
    res.json({ vehicle, orders });
});

// Update driver current location or report status
app.post('/api/driver/location', authenticateToken, (req, res) => {
    const { latitude, longitude } = req.body;
    const vehicle = db.vehicles.findByDriver(req.user.id);
    if (!vehicle) return res.status(404).json({ message: 'No vehicle found' });

    const updatedVehicle = db.vehicles.update(vehicle.id, { latitude, longitude });
    res.json(updatedVehicle);
});

// Driver Action: Start Trip / Complete Order Node / Report Breakdown
app.post('/api/driver/action', authenticateToken, (req, res) => {
    const { action, val } = req.body; // 'start', 'complete_order', 'breakdown'
    const vehicle = db.vehicles.findByDriver(req.user.id);
    if (!vehicle) return res.status(404).json({ message: 'No vehicle found' });

    if (action === 'start') {
        db.vehicles.update(vehicle.id, { status: 'Busy' });
        const orders = db.orders.findByVehicle(vehicle.id);
        orders.forEach(o => db.orders.update(o.id, { status: 'In Transit' }));
        return res.json({ status: 'Busy', message: 'Trip started successfully' });
    }

    if (action === 'complete_order') {
        db.orders.update(val, { status: 'Completed' });

        // Update vehicle coordinates to the customer coordinates
        const orderObj = db.orders.findOne(val);
        if (orderObj) {
            const custObj = db.customers.findOne(orderObj.customerId);
            if (custObj) {
                db.vehicles.update(vehicle.id, { latitude: custObj.latitude, longitude: custObj.longitude });
            }
        }

        // Check if all orders for this vehicle are completed
        const unresolved = db.orders.findByVehicle(vehicle.id).filter(o => o.status !== 'Completed');
        if (unresolved.length === 0) {
            db.vehicles.update(vehicle.id, { status: 'Available' });
        }
        return res.json({ message: 'Order marked as completed' });
    }

    if (action === 'breakdown') {
        db.vehicles.update(vehicle.id, { status: 'Under Maintenance' });
        db.vehicleEvents.create({ vehicleId: vehicle.id, type: 'Breakdown', description: 'Driver reported vehicle breakdown and stopped.' });

        // Auto reassign pending orders from this vehicle to other available vehicles
        const pendingOrders = db.orders.findByVehicle(vehicle.id).filter(o => o.status !== 'Completed');
        const availableVehicles = db.vehicles.find().filter(v => v.id !== vehicle.id && v.status === 'Available');

        if (availableVehicles.length > 0) {
            pendingOrders.forEach((o, index) => {
                const assignedVeh = availableVehicles[index % availableVehicles.length];
                db.orders.update(o.id, { vehicleId: assignedVeh.id, status: 'Pending' });
            });
        }

        return res.json({ status: 'Under Maintenance', message: 'Breakdown reported. Orders re-routed.' });
    }

    res.status(400).json({ message: 'Invalid action' });
});

// --- OPTIMIZER API ---
// Generate client route outputs with Classical vs Quantum side-by-side
app.get('/api/optimizer/compare', (req, res) => {
    const { warehouseId, vehicleId } = req.query;
    if (!warehouseId || !vehicleId) {
        return res.status(400).json({ message: 'Missing warehouseId or vehicleId' });
    }

    const warehouse = db.warehouses.findOne(warehouseId);
    const vehicle = db.vehicles.findOne(vehicleId);
    if (!warehouse || !vehicle) {
        return res.status(404).json({ message: 'Warehouse or vehicle not found' });
    }

    // Get orders assigned to this vehicle
    const orders = db.orders.findByVehicle(vehicleId);
    if (orders.length === 0) {
        return res.json({
            classical: { route: [], metrics: { totalDistance: 0, totalTimeMinutes: 0, fuelConsumedLiters: 0, co2EmissionKg: 0, costRupees: 0 } },
            quantum: { route: [], metrics: { totalDistance: 0, totalTimeMinutes: 0, fuelConsumedLiters: 0, co2EmissionKg: 0, costRupees: 0 } }
        });
    }

    // Fetch full details of customers associated with the orders
    const customerNodes = orders.map(o => {
        const cust = db.customers.findOne(o.customerId);
        return {
            id: cust.id,
            name: cust.name,
            latitude: cust.latitude,
            longitude: cust.longitude,
            priority: cust.priority,
            orderId: o.id
        };
    });

    const trafficEvents = db.trafficEvents.find();
    const vehicleEvents = db.vehicleEvents.find();

    const classicalResult = solveClassical(warehouse, customerNodes, trafficEvents);
    const quantumResult = solveHybridQuantum(warehouse, customerNodes, trafficEvents, vehicleEvents);

    res.json({
        classical: classicalResult,
        quantum: quantumResult
    });
});

// Apply/save routes - selects classical or quantum paths
app.post('/api/optimizer/apply', (req, res) => {
    const { vehicleId, path, strategy } = req.body;
    // Update order paths, status, etc.
    const orders = db.orders.findByVehicle(vehicleId);
    orders.forEach(o => {
        db.orders.update(o.id, { status: 'Pending', path: path.map(p => ({ lat: p.latitude, lng: p.longitude })) });
    });
    res.json({ message: `Route using [${strategy}] applied successfully` });
});

// --- SIMULATION EVENTS & TICK ---
app.get('/api/events', (req, res) => {
    res.json({
        traffic: db.trafficEvents.find(),
        vehicles: db.vehicleEvents.find()
    });
});

// Trigger a traffic block in Chennai (seeded coordinates)
app.post('/api/events/traffic', (req, res) => {
    const { latitude, longitude, severity, description } = req.body;
    const evt = db.trafficEvents.create({ latitude, longitude, severity, description });
    res.json({ message: 'Traffic block successfully registered', event: evt });
});

app.post('/api/events/vehicle', (req, res) => {
    const { vehicleId, type, description } = req.body;
    const evt = db.vehicleEvents.create({ vehicleId, type, description });

    if (type === 'Breakdown') {
        db.vehicles.update(vehicleId, { status: 'Under Maintenance' });

        // Auto reassign pending orders from this vehicle
        const pendingOrders = db.orders.findByVehicle(vehicleId).filter(o => o.status !== 'Completed');
        const availableVehicles = db.vehicles.find().filter(v => v.id !== vehicleId && v.status === 'Available');

        if (availableVehicles.length > 0) {
            pendingOrders.forEach((o, idx) => {
                const nextVeh = availableVehicles[idx % availableVehicles.length];
                db.orders.update(o.id, { vehicleId: nextVeh.id, status: 'Pending' });
            });
        }
    }

    res.json({ message: 'Vehicle event registered and routes mitigated', event: evt });
});

app.post('/api/events/clear', (req, res) => {
    db.trafficEvents.clear();
    db.vehicleEvents.clear();
    // Reset vehicles back to normal if they were in breakdown
    db.vehicles.find().forEach(v => {
        if (v.status === 'Under Maintenance') {
            db.vehicles.update(v.id, { status: 'Available' });
        }
    });
    res.json({ message: 'All dynamic obstacles and breakdowns cleared' });
});

// Database reset
app.post('/api/events/reset', (req, res) => {
    const data = db.resetToDefault();
    res.json({ message: 'System database reset to default seeds successfully', data });
});

// Simulation tick: causes vehicles to advance towards their customer destinations
app.post('/api/simulation/tick', (req, res) => {
    const vehicles = db.vehicles.find();
    const updatedVehicles = [];

    for (const v of vehicles) {
        if (v.status !== 'Busy') continue;

        const orders = db.orders.findByVehicle(v.id).filter(o => o.status !== 'Completed');
        if (orders.length === 0) {
            // Return vehicle to warehouse or mark Available
            db.vehicles.update(v.id, { status: 'Available' });
            continue;
        }

        // Move vehicle towards the first unresolved order customer coordinate
        const targetOrder = orders[0];
        const cust = db.customers.findOne(targetOrder.customerId);
        if (!cust) continue;

        const currentLat = v.latitude;
        const currentLng = v.longitude;
        const targetLat = cust.latitude;
        const targetLng = cust.longitude;

        const dLat = targetLat - currentLat;
        const dLng = targetLng - currentLng;
        const distanceToTarget = Math.sqrt(dLat * dLat + dLng * dLng);

        // Speed step factor: move 20% of remaining distance to target node
        if (distanceToTarget < 0.005) {
            // Arrived! Clear this node
            db.orders.update(targetOrder.id, { status: 'Completed' });
            db.vehicles.update(v.id, { latitude: targetLat, longitude: targetLng });

            const remaining = db.orders.findByVehicle(v.id).filter(o => o.status !== 'Completed');
            if (remaining.length === 0) {
                db.vehicles.update(v.id, { status: 'Available' });
            }
        } else {
            // Move closer
            const step = 0.25; // Speed multiplier
            const newLat = currentLat + dLat * step;
            const newLng = currentLng + dLng * step;
            db.vehicles.update(v.id, { latitude: Number(newLat.toFixed(5)), longitude: Number(newLng.toFixed(5)) });
        }
        updatedVehicles.push(db.vehicles.findOne(v.id));
    }

    res.json({
        vehicles: db.vehicles.find(),
        orders: db.orders.find()
    });
});

app.listen(PORT, () => {
    console.log(`SmartRoute AI Backend running on port ${PORT}`);
});
