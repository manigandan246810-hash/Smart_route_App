import { User } from './models/User.js';
import { Driver } from './models/Driver.js';
import { Vehicle } from './models/Vehicle.js';
import { Warehouse } from './models/Warehouse.js';
import { Customer } from './models/Customer.js';
import { Order } from './models/Order.js';
import { Trip } from './models/Trip.js';
import { Notification } from './models/Notification.js';
import { QuantumJob } from './models/QuantumJob.js';
import { TrafficEvent } from './models/TrafficEvent.js';
import { VehicleBreakdown } from './models/VehicleBreakdown.js';

// Seed data definition matching original db.js
const seedData = {
    users: [
        { id: 'usr-1', name: 'Admin Master', email: 'admin@smartroute.com', password: 'admin123', role: 'admin' },
        { id: 'usr-2', name: 'Rajesh Kumar', email: 'driver1@smartroute.com', password: 'driver123', role: 'driver' },
        { id: 'usr-3', name: 'Suresh Raina', email: 'driver2@smartroute.com', password: 'driver123', role: 'driver' },
        { id: 'usr-4', name: 'Kumar Logan', email: 'driver3@smartroute.com', password: 'driver123', role: 'driver' },
        { id: 'usr-5', name: 'Gautam Gambhir', email: 'driver4@smartroute.com', password: 'driver123', role: 'driver' },
        { id: 'usr-6', name: 'Mahendra Dhoni', email: 'driver5@smartroute.com', password: 'driver123', role: 'driver' },
        { id: 'usr-7', name: 'Sachin Tendulkar', email: 'driver6@smartroute.com', password: 'driver123', role: 'driver' },
        { id: 'usr-8', name: 'Rishabh Pant', email: 'driver7@smartroute.com', password: 'driver123', role: 'driver' },
        { id: 'usr-9', name: 'Shreyas Iyer', email: 'driver8@smartroute.com', password: 'driver123', role: 'driver' },
        { id: 'usr-10', name: 'Shubman Gill', email: 'driver9@smartroute.com', password: 'driver123', role: 'driver' }
    ],
    drivers: [
        { id: 'usr-2', name: 'Rajesh Kumar', email: 'driver1@smartroute.com', password: 'driver123', phone: '+91 98765 43210', license: 'DL-01202300456', licenseExpiry: '2028-12-31', address: 'Adyar, Chennai', driverClass: '4-Wheeler Driver', vehicleId: 'veh-1', gps: { lat: 13.0827, lng: 80.2707 }, status: 'Available', batteryLevel: 88, networkStatus: 'Excellent', currentSpeed: 0, activeTrip: null, score: 98, completedTrips: 24, cancelledTrips: 1, joinedDate: '2023-01-15' },
        { id: 'usr-3', name: 'Suresh Raina', email: 'driver2@smartroute.com', password: 'driver123', phone: '+91 97654 32109', license: 'DL-09202200876', licenseExpiry: '2029-06-30', address: 'Guindy, Chennai', driverClass: '4-Wheeler Driver', vehicleId: 'veh-2', gps: { lat: 13.0067, lng: 80.2206 }, status: 'Available', batteryLevel: 75, networkStatus: 'Good', currentSpeed: 0, activeTrip: null, score: 94, completedTrips: 18, cancelledTrips: 0, joinedDate: '2023-05-10' },
        { id: 'usr-4', name: 'Kumar Logan', email: 'driver3@smartroute.com', password: 'driver123', phone: '+91 96543 21098', license: 'DL-07202400912', licenseExpiry: '2030-02-14', address: 'Central, Chennai', driverClass: '4-Wheeler Driver', vehicleId: 'veh-3', gps: { lat: 13.0827, lng: 80.2707 }, status: 'Available', batteryLevel: 92, networkStatus: 'Excellent', currentSpeed: 0, activeTrip: null, score: 91, completedTrips: 15, cancelledTrips: 2, joinedDate: '2024-02-01' },
        { id: 'usr-5', name: 'Gautam Gambhir', email: 'driver4@smartroute.com', password: 'driver123', phone: '+91 95432 10987', license: 'DL-04202300567', licenseExpiry: '2031-05-20', address: 'Mylapore, Chennai', driverClass: '4-Wheeler Driver', vehicleId: 'veh-4', gps: { lat: 13.0330, lng: 80.2690 }, status: 'Available', batteryLevel: 80, networkStatus: 'Excellent', currentSpeed: 0, activeTrip: null, score: 96, completedTrips: 12, cancelledTrips: 0, joinedDate: '2023-09-01' },
        { id: 'usr-6', name: 'Mahendra Dhoni', email: 'driver5@smartroute.com', password: 'driver123', phone: '+91 94321 09876', license: 'DL-05202100678', licenseExpiry: '2032-08-15', address: 'Velachery, Chennai', driverClass: '4-Wheeler Driver', vehicleId: 'veh-5', gps: { lat: 12.9796, lng: 80.2245 }, status: 'Available', batteryLevel: 95, networkStatus: 'Excellent', currentSpeed: 0, activeTrip: null, score: 99, completedTrips: 30, cancelledTrips: 1, joinedDate: '2021-11-10' },
        { id: 'usr-7', name: 'Sachin Tendulkar', email: 'driver6@smartroute.com', password: 'driver123', phone: '+91 93210 98765', license: 'DL-10202000789', licenseExpiry: '2033-04-25', address: 'Nungambakkam, Chennai', driverClass: '4-Wheeler Driver', vehicleId: 'veh-6', gps: { lat: 13.0600, lng: 80.2400 }, status: 'Available', batteryLevel: 90, networkStatus: 'Good', currentSpeed: 0, activeTrip: null, score: 97, completedTrips: 45, cancelledTrips: 0, joinedDate: '2020-05-15' },
        { id: 'usr-8', name: 'Rishabh Pant', email: 'driver7@smartroute.com', password: 'driver123', phone: '+91 92109 87654', license: 'DL-06202400111', licenseExpiry: '2034-01-10', address: 'Central, Chennai', driverClass: 'Two-Wheeler Driver', vehicleId: 'veh-7', gps: { lat: 13.0827, lng: 80.2707 }, status: 'Available', batteryLevel: 98, networkStatus: 'Excellent', currentSpeed: 0, activeTrip: null, score: 95, completedTrips: 10, cancelledTrips: 0, joinedDate: '2024-03-15' },
        { id: 'usr-9', name: 'Shreyas Iyer', email: 'driver8@smartroute.com', password: 'driver123', phone: '+91 91098 76543', license: 'DL-08202400222', licenseExpiry: '2034-05-18', address: 'Guindy, Chennai', driverClass: 'Two-Wheeler Driver', vehicleId: 'veh-8', gps: { lat: 13.0067, lng: 80.2206 }, status: 'Available', batteryLevel: 92, networkStatus: 'Excellent', currentSpeed: 0, activeTrip: null, score: 96, completedTrips: 14, cancelledTrips: 0, joinedDate: '2024-04-01' },
        { id: 'usr-10', name: 'Shubman Gill', email: 'driver9@smartroute.com', password: 'driver123', phone: '+91 90987 65432', license: 'DL-10202400333', licenseExpiry: '2034-08-22', address: 'T-Nagar, Chennai', driverClass: 'Two-Wheeler Driver', vehicleId: 'veh-9', gps: { lat: 13.0418, lng: 80.2337 }, status: 'Available', batteryLevel: 100, networkStatus: 'Excellent', currentSpeed: 0, activeTrip: null, score: 99, completedTrips: 22, cancelledTrips: 0, joinedDate: '2024-01-20' }
    ],
    vehicles: [
        { id: 'veh-1', vehicleNo: 'TN-01-AX-1234', model: 'Tata Ace Gold EV', capacity: 600, status: 'Available', fuel: 95, maintenanceStatus: 'Normal', category: '4-Wheeler', warehouseId: 'wh-1', driverId: 'usr-2', latitude: 13.0827, longitude: 80.2707 },
        { id: 'veh-2', vehicleNo: 'TN-09-BY-5678', model: 'Mahindra Supro Cargo', capacity: 900, status: 'Available', fuel: 82, maintenanceStatus: 'Normal', category: '4-Wheeler', warehouseId: 'wh-2', driverId: 'usr-3', latitude: 13.0067, longitude: 80.2206 },
        { id: 'veh-3', vehicleNo: 'TN-07-CZ-9012', model: 'Ashok Leyland Dost', capacity: 1200, status: 'Available', fuel: 70, maintenanceStatus: 'Normal', category: '4-Wheeler', warehouseId: 'wh-1', driverId: 'usr-4', latitude: 13.0827, longitude: 80.2707 },
        { id: 'veh-4', vehicleNo: 'TN-02-DW-2234', model: 'Eicher Pro EV', capacity: 1500, status: 'Available', fuel: 88, maintenanceStatus: 'Normal', category: '4-Wheeler', warehouseId: 'wh-1', driverId: 'usr-5', latitude: 13.0330, longitude: 80.2690 },
        { id: 'veh-5', vehicleNo: 'TN-05-ER-5567', model: 'BYD T3 EV', capacity: 1000, status: 'Available', fuel: 91, maintenanceStatus: 'Normal', category: '4-Wheeler', warehouseId: 'wh-2', driverId: 'usr-6', latitude: 12.9796, longitude: 80.2245 },
        { id: 'veh-6', vehicleNo: 'TN-03-GH-9901', model: 'Mahindra Treo Zor', capacity: 700, status: 'Available', fuel: 85, maintenanceStatus: 'Normal', category: '4-Wheeler', warehouseId: 'wh-1', driverId: 'usr-7', latitude: 13.0600, longitude: 80.2400 },
        { id: 'veh-7', vehicleNo: 'TN-06-TW-1010', model: 'Ather 450X Cargo EV (2-Wheeler)', capacity: 100, status: 'Available', fuel: 98, maintenanceStatus: 'Normal', category: 'Two-Wheeler', warehouseId: 'wh-1', driverId: 'usr-8', latitude: 13.0827, longitude: 80.2707 },
        { id: 'veh-8', vehicleNo: 'TN-08-TW-2020', model: 'TVS iQube Delivery EV (2-Wheeler)', capacity: 120, status: 'Available', fuel: 92, maintenanceStatus: 'Normal', category: 'Two-Wheeler', warehouseId: 'wh-2', driverId: 'usr-9', latitude: 13.0067, longitude: 80.2206 },
        { id: 'veh-9', vehicleNo: 'TN-10-TW-3030', model: 'Hero Nyx HX Heavy EV (2-Wheeler)', capacity: 150, status: 'Available', fuel: 100, maintenanceStatus: 'Normal', category: 'Two-Wheeler', warehouseId: 'wh-1', driverId: 'usr-10', latitude: 13.0418, longitude: 80.2337 }
    ],
    warehouses: [
        { id: 'wh-1', name: 'Chennai Central Gateway', manager: 'Anand Sharma', address: 'Chennai Central Station Rd, TN 600003', latitude: 13.0827, longitude: 80.2707, capacity: 50000, currentInventory: 32000, activeVehicles: 3, waitingOrders: 1 },
        { id: 'wh-2', name: 'Guindy Industrial Hub', manager: 'Manoj Pillai', address: 'Guindy Industrial Estate, Chennai, TN 600032', latitude: 13.0067, longitude: 80.2206, capacity: 80000, currentInventory: 48000, activeVehicles: 3, waitingOrders: 1 }
    ],
    customers: [
        { id: 'cust-1', name: 'Mylapore Retailers', address: 'Mylapore, Chennai', latitude: 13.0330, longitude: 80.2690, priority: 'High' },
        { id: 'cust-2', name: 'Nungambakkam Bazaar Ltd', address: 'Nungambakkam, Chennai', latitude: 13.0600, longitude: 80.2400, priority: 'Medium' },
        { id: 'cust-3', name: 'Adyar Distribution Core', address: 'Adyar, Chennai', latitude: 12.9982, longitude: 80.2564, priority: 'Medium' },
        { id: 'cust-4', name: 'Velachery Tech Store', address: 'Velachery, Chennai', latitude: 12.9796, longitude: 80.2245, priority: 'Low' },
        { id: 'cust-5', name: 'Anna Nagar Supermall', address: 'Anna Nagar, Chennai', latitude: 13.0850, longitude: 80.2100, priority: 'High' },
        { id: 'cust-6', name: 'T-Nagar Plaza Outlets', address: 'T-Nagar, Chennai', latitude: 13.0418, longitude: 80.2337, priority: 'High' }
    ],
    orders: [
        { id: 'ord-1', customerId: 'cust-1', warehouseId: 'wh-1', vehicleId: 'veh-1', status: 'Pending', priority: 'High', distance: 6.8, eta: 18, quantumStatus: 'Ready', size: 180, deadline: '3 Hours', createdAt: new Date().toISOString() },
        { id: 'ord-2', customerId: 'cust-3', warehouseId: 'wh-2', vehicleId: 'veh-2', status: 'Pending', priority: 'Medium', distance: 4.5, eta: 14, quantumStatus: 'Ready', size: 240, deadline: '5 Hours', createdAt: new Date().toISOString() },
        { id: 'ord-3', customerId: 'cust-4', warehouseId: 'wh-2', vehicleId: 'veh-8', status: 'Pending', priority: 'Low', distance: 3.2, eta: 10, quantumStatus: 'Ready', size: 90, deadline: '8 Hours', createdAt: new Date().toISOString() },
        { id: 'ord-4', customerId: 'cust-6', warehouseId: 'wh-1', vehicleId: 'veh-3', status: 'Pending', priority: 'High', distance: 5.7, eta: 15, quantumStatus: 'Ready', size: 310, deadline: '2 Hours', createdAt: new Date().toISOString() },
        { id: 'ord-5', customerId: 'cust-2', warehouseId: 'wh-1', vehicleId: 'veh-4', status: 'Pending', priority: 'Medium', distance: 4.2, eta: 12, quantumStatus: 'Ready', size: 150, deadline: '4 Hours', createdAt: new Date().toISOString() },
        { id: 'ord-6', customerId: 'cust-5', warehouseId: 'wh-1', vehicleId: 'veh-1', status: 'Pending', priority: 'High', distance: 7.5, eta: 20, quantumStatus: 'Ready', size: 200, deadline: '2 Hours', createdAt: new Date().toISOString() },
        { id: 'ord-7', customerId: 'cust-1', warehouseId: 'wh-2', vehicleId: 'veh-5', status: 'Pending', priority: 'Medium', distance: 5.1, eta: 15, quantumStatus: 'Ready', size: 130, deadline: '6 Hours', createdAt: new Date().toISOString() },
        { id: 'ord-8', customerId: 'cust-3', warehouseId: 'wh-1', vehicleId: 'veh-6', status: 'Pending', priority: 'Low', distance: 6.0, eta: 18, quantumStatus: 'Ready', size: 110, deadline: '9 Hours', createdAt: new Date().toISOString() },
        { id: 'ord-9', customerId: 'cust-5', warehouseId: 'wh-1', vehicleId: 'veh-3', status: 'Pending', priority: 'High', distance: 7.2, eta: 19, quantumStatus: 'Ready', size: 175, deadline: '2 Hours', createdAt: new Date().toISOString() },
        { id: 'ord-10', customerId: 'cust-2', warehouseId: 'wh-2', vehicleId: 'veh-5', status: 'Pending', priority: 'Medium', distance: 5.5, eta: 16, quantumStatus: 'Ready', size: 140, deadline: '4 Hours', createdAt: new Date().toISOString() },
        { id: 'ord-11', customerId: 'cust-1', warehouseId: 'wh-1', vehicleId: 'veh-7', status: 'Pending', priority: 'High', distance: 2.4, eta: 7, quantumStatus: 'Ready', size: 25, deadline: '1 Hour', createdAt: new Date().toISOString() },
        { id: 'ord-12', customerId: 'cust-6', warehouseId: 'wh-1', vehicleId: 'veh-7', status: 'Pending', priority: 'High', distance: 3.1, eta: 8, quantumStatus: 'Ready', size: 40, deadline: '1 Hour', createdAt: new Date().toISOString() },
        { id: 'ord-13', customerId: 'cust-4', warehouseId: 'wh-2', vehicleId: 'veh-8', status: 'Pending', priority: 'Medium', distance: 1.8, eta: 5, quantumStatus: 'Ready', size: 15, deadline: '30 Mins', createdAt: new Date().toISOString() },
        { id: 'ord-14', customerId: 'cust-3', warehouseId: 'wh-2', vehicleId: 'veh-8', status: 'Pending', priority: 'High', distance: 2.9, eta: 8, quantumStatus: 'Ready', size: 50, deadline: '1.5 Hours', createdAt: new Date().toISOString() },
        { id: 'ord-15', customerId: 'cust-2', warehouseId: 'wh-1', vehicleId: 'veh-9', status: 'Pending', priority: 'Medium', distance: 2.1, eta: 6, quantumStatus: 'Ready', size: 35, deadline: '2 Hours', createdAt: new Date().toISOString() }
    ],
    notifications: [
        { id: 'not-1', title: 'System Initialized', message: 'SmartRoute Quantum routing node connected to MongoDB Atlas Database.', timestamp: new Date().toISOString(), read: false, type: 'System' }
    ]
};

// Seeder logic to initialize collection state
// Seeder logic to initialize collection state
export async function seedDatabase() {
    try {
        console.log('Verifying collection seed status on MongoDB Atlas...');

        // 1. Seed Users
        console.log('Verifying user seed state...');
        for (const u of seedData.users) {
            const exists = await User.exists({ _id: u.id });
            if (!exists) {
                console.log(`Inserting missing seed user: ${u.id} (${u.name})`);
                await User.create({
                    _id: u.id,
                    name: u.name,
                    email: u.email,
                    password: u.password,
                    role: u.role
                });
            }
        }

        // 2. Seed Drivers
        console.log('Verifying driver seed state...');
        for (const d of seedData.drivers) {
            const exists = await Driver.exists({ _id: d.id });
            if (!exists) {
                console.log(`Inserting missing seed driver: ${d.id} (${d.name})`);
                await Driver.create({
                    _id: d.id,
                    name: d.name,
                    email: d.email,
                    password: d.password,
                    phone: d.phone,
                    license: d.license,
                    licenseExpiry: d.licenseExpiry,
                    address: d.address,
                    driverClass: d.driverClass || '4-Wheeler Driver',
                    vehicleId: d.vehicleId,
                    gps: d.gps,
                    status: d.status,
                    batteryLevel: d.batteryLevel,
                    networkStatus: d.networkStatus,
                    currentSpeed: d.currentSpeed,
                    activeTrip: d.activeTrip,
                    score: d.score,
                    completedTrips: d.completedTrips,
                    cancelledTrips: d.cancelledTrips,
                    joinedDate: d.joinedDate
                });
            } else {
                await Driver.updateOne({ _id: d.id }, { $set: { vehicleId: d.vehicleId, driverClass: d.driverClass || '4-Wheeler Driver', status: 'Available', activeTrip: null } });
            }
        }

        // 3. Seed Vehicles
        console.log('Verifying vehicle seed state...');
        for (const v of seedData.vehicles) {
            const exists = await Vehicle.exists({ _id: v.id });
            if (!exists) {
                console.log(`Inserting missing seed vehicle: ${v.id} (${v.model})`);
                await Vehicle.create({
                    _id: v.id,
                    vehicleNo: v.vehicleNo,
                    model: v.model,
                    capacity: v.capacity,
                    status: v.status,
                    fuel: v.fuel,
                    maintenanceStatus: v.maintenanceStatus,
                    category: v.category || '4-Wheeler',
                    warehouseId: v.warehouseId,
                    driverId: v.driverId,
                    latitude: v.latitude,
                    longitude: v.longitude
                });
            } else {
                await Vehicle.updateOne({ _id: v.id }, { $set: { driverId: v.driverId } });
            }
        }

        // 4. Seed Warehouses
        const warehouseCount = await Warehouse.countDocuments();
        if (warehouseCount === 0) {
            console.log('Seeding initial Warehouses...');
            const warehousesToInsert = seedData.warehouses.map(w => ({
                _id: w.id,
                name: w.name,
                manager: w.manager,
                address: w.address,
                latitude: w.latitude,
                longitude: w.longitude,
                capacity: w.capacity,
                currentInventory: w.currentInventory,
                activeVehicles: w.activeVehicles,
                waitingOrders: w.waitingOrders
            }));
            await Warehouse.insertMany(warehousesToInsert);
        }

        // 5. Seed Customers
        const customerCount = await Customer.countDocuments();
        if (customerCount === 0) {
            console.log('Seeding initial Customers...');
            const customersToInsert = seedData.customers.map(c => ({
                _id: c.id,
                name: c.name,
                address: c.address,
                latitude: c.latitude,
                longitude: c.longitude,
                priority: c.priority
            }));
            await Customer.insertMany(customersToInsert);
        }

        // 6. Seed Orders
        console.log('Verifying orders seed state...');
        for (const o of seedData.orders) {
            const exists = await Order.exists({ _id: o.id });
            if (!exists) {
                console.log(`Inserting missing seed order: ${o.id}`);
                await Order.create({
                    _id: o.id,
                    customerId: o.customerId,
                    warehouseId: o.warehouseId,
                    vehicleId: o.vehicleId,
                    status: o.status,
                    priority: o.priority,
                    distance: o.distance,
                    eta: o.eta,
                    quantumStatus: o.quantumStatus,
                    size: o.size,
                    deadline: o.deadline,
                    createdAt: o.createdAt
                });
            }
        }

        // 7. Seed Notifications
        const notificationCount = await Notification.countDocuments();
        if (notificationCount === 0) {
            console.log('Seeding initial Notifications...');
            const notificationsToInsert = seedData.notifications.map(n => ({
                _id: n.id,
                title: n.title,
                message: n.message,
                timestamp: n.timestamp,
                read: n.read,
                type: n.type
            }));
            await Notification.insertMany(notificationsToInsert);
        }

        console.log('Verification & seed completed successfully!');
    } catch (e) {
        console.error('Error during database verification or seed:', e);
    }
}

function mapId(doc) {
    if (!doc) return null;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc;
    if (obj._id && !obj.id) {
        obj.id = obj._id;
    }
    return obj;
}

function mapIds(docs) {
    if (!docs) return [];
    return docs.map(mapId);
}

// Export asynchronous db wrapper conforming to existing layout
export const db = {
    users: {
        find: async () => mapIds(await User.find({})),
        findOne: async (query) => {
            // Adapt query properties from "id" to "_id" if present
            const adaptedQuery = { ...query };
            if (adaptedQuery.id) {
                adaptedQuery._id = adaptedQuery.id;
                delete adaptedQuery.id;
            }
            return mapId(await User.findOne(adaptedQuery));
        }
    },
    drivers: {
        find: async () => mapIds(await Driver.find({})),
        findOne: async (id) => mapId(await Driver.findOne({ _id: id })),
        update: async (id, payload) => {
            return mapId(await Driver.findOneAndUpdate({ _id: id }, { $set: payload }, { new: true }));
        },
        create: async (payload) => {
            const userId = payload.id || `usr-${Date.now()}`;
            
            // Create user account
            await User.create({
                _id: userId,
                name: payload.name,
                email: payload.email,
                password: payload.password || 'driver123',
                role: 'driver'
            });

            // Create driver profile
            return mapId(await Driver.create({
                _id: userId,
                name: payload.name,
                email: payload.email,
                password: payload.password || 'driver123',
                phone: payload.phone || '+91 99999 88888',
                license: payload.license || 'DL-PENDING',
                licenseExpiry: payload.licenseExpiry || '2030-01-01',
                address: payload.address || 'Chennai, TN',
                vehicleId: payload.vehicleId || null,
                gps: payload.gps || { lat: 13.0827, lng: 80.2707 },
                status: payload.status || 'Available',
                batteryLevel: 100,
                networkStatus: 'Excellent',
                currentSpeed: 0,
                activeTrip: null,
                score: 100,
                completedTrips: 0,
                cancelledTrips: 0,
                joinedDate: payload.joinedDate || new Date().toISOString().split('T')[0]
            }));
        },
        delete: async (id) => {
            await Driver.deleteOne({ _id: id });
            await User.deleteOne({ _id: id });
            return true;
        }
    },
    vehicles: {
        find: async () => mapIds(await Vehicle.find({})),
        findOne: async (id) => mapId(await Vehicle.findOne({ _id: id })),
        findByDriver: async (driverId) => mapId(await Vehicle.findOne({ driverId })),
        update: async (id, payload) => {
            return mapId(await Vehicle.findOneAndUpdate({ _id: id }, { $set: payload }, { new: true }));
        }
    },
    warehouses: {
        find: async () => mapIds(await Warehouse.find({})),
        findOne: async (id) => mapId(await Warehouse.findOne({ _id: id })),
        update: async (id, payload) => {
            return mapId(await Warehouse.findOneAndUpdate({ _id: id }, { $set: payload }, { new: true }));
        },
        create: async (payload) => {
            const id = payload.id || `wh-${Date.now()}`;
            return mapId(await Warehouse.create({
                _id: id,
                name: payload.name,
                manager: payload.manager || 'Operations Manager',
                address: payload.address || 'Chennai Metro',
                latitude: Number(payload.latitude) || 13.0827,
                longitude: Number(payload.longitude) || 80.2707,
                capacity: Number(payload.capacity) || 50000,
                currentInventory: Number(payload.currentInventory) || 0,
                activeVehicles: 0,
                waitingOrders: 0,
                status: payload.status || 'Active'
            }));
        },
        delete: async (id) => {
            await Warehouse.deleteOne({ _id: id });
            return true;
        }
    },
    customers: {
        find: async () => mapIds(await Customer.find({})),
        findOne: async (id) => mapId(await Customer.findOne({ _id: id }))
    },
    orders: {
        find: async () => mapIds(await Order.find({})),
        findOne: async (id) => mapId(await Order.findOne({ _id: id })),
        findByVehicle: async (vehicleId) => mapIds(await Order.find({ vehicleId })),
        create: async (payload) => {
            const id = payload.id || `ord-${Date.now()}`;
            return mapId(await Order.create({
                _id: id,
                status: 'Pending',
                priority: payload.priority || 'Medium',
                quantumStatus: 'Ready',
                ...payload
            }));
        },
        update: async (id, payload) => {
            return mapId(await Order.findOneAndUpdate({ _id: id }, { $set: payload }, { new: true }));
        },
        delete: async (id) => {
            await Order.deleteOne({ _id: id });
            return true;
        }
    },
    trips: {
        find: async () => mapIds(await Trip.find({})),
        findOne: async (id) => mapId(await Trip.findOne({ _id: id })),
        findByDriver: async (driverId) => {
            return mapId(await Trip.findOne({
                driverId,
                status: { $nin: ['Completed', 'Rejected'] }
            }));
        },
        create: async (payload) => {
            const id = payload.id || `trp-${Date.now()}`;
            return mapId(await Trip.create({
                _id: id,
                status: 'Assigned',
                ...payload
            }));
        },
        update: async (id, payload) => {
            return mapId(await Trip.findOneAndUpdate({ _id: id }, { $set: payload }, { new: true }));
        }
    },
    notifications: {
        find: async () => mapIds(await Notification.find({}).sort({ timestamp: -1 })),
        create: async (payload) => {
            const id = payload.id || `not-${Date.now()}`;
            return mapId(await Notification.create({
                _id: id,
                read: false,
                timestamp: new Date().toISOString(),
                ...payload
            }));
        },
        markAllRead: async () => {
            await Notification.updateMany({}, { $set: { read: true } });
            return true;
        }
    },
    quantumJobs: {
        find: async () => mapIds(await QuantumJob.find({})),
        create: async (payload) => {
            const id = payload.id || `job-${Date.now()}`;
            return mapId(await QuantumJob.create({
                _id: id,
                timestamp: new Date().toISOString(),
                ...payload
            }));
        }
    },
    trafficEvents: {
        find: async () => mapIds(await TrafficEvent.find({})),
        findOne: async (id) => mapId(await TrafficEvent.findOne({ _id: id })),
        create: async (payload) => {
            const id = payload.id || `trf-${Date.now()}`;
            return mapId(await TrafficEvent.create({
                _id: id,
                timestamp: new Date().toISOString(),
                ...payload
            }));
        },
        update: async (id, payload) => {
            return mapId(await TrafficEvent.findOneAndUpdate({ _id: id }, { $set: payload }, { new: true }));
        },
        clear: async () => {
            await TrafficEvent.deleteMany({});
            return true;
        }
    },
    vehicleBreakdowns: {
        find: async () => mapIds(await VehicleBreakdown.find({})),
        findOne: async (id) => mapId(await VehicleBreakdown.findOne({ _id: id })),
        create: async (payload) => {
            const id = payload.id || `brk-${Date.now()}`;
            return mapId(await VehicleBreakdown.create({
                _id: id,
                timestamp: new Date().toISOString(),
                ...payload
            }));
        },
        update: async (id, payload) => {
            return mapId(await VehicleBreakdown.findOneAndUpdate({ _id: id }, { $set: payload }, { new: true }));
        },
        clear: async () => {
            await VehicleBreakdown.deleteMany({});
            return true;
        }
    },
    reset: async () => {
        // Drop all collections
        await User.deleteMany({});
        await Driver.deleteMany({});
        await Vehicle.deleteMany({});
        await Warehouse.deleteMany({});
        await Customer.deleteMany({});
        await Order.deleteMany({});
        await Trip.deleteMany({});
        await Notification.deleteMany({});
        await QuantumJob.deleteMany({});
        await TrafficEvent.deleteMany({});
        await VehicleBreakdown.deleteMany({});

        // Reseed
        await seedDatabase();
        return true;
    }
};
