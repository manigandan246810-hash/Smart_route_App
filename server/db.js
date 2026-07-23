import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'data.json');

// Default initial seed data (Chennai-focused coordinates)
const defaultData = {
  users: [
    { id: 'usr-1', name: 'Admin User', email: 'admin@smartroute.com', password: 'admin123', role: 'admin' },
    { id: 'usr-2', name: 'Rajesh Kumar', email: 'driver1@smartroute.com', password: 'driver123', role: 'driver' },
    { id: 'usr-3', name: 'Suresh Raina', email: 'driver2@smartroute.com', password: 'driver123', role: 'driver' },
    { id: 'usr-4', name: 'Kumar Logan', email: 'driver3@smartroute.com', password: 'driver123', role: 'driver' }
  ],
  warehouses: [
    { id: 'wh-1', name: 'Chennai Central Hub', latitude: 13.0827, longitude: 80.2707, address: 'Chennai Central Station Rd, TN 600003' },
    { id: 'wh-2', name: 'Guindy Industrial Depot', latitude: 13.0067, longitude: 80.2206, address: 'Guindy Industrial Estate, Chennai, TN 600032' }
  ],
  drivers: [
    { id: 'usr-2', name: 'Rajesh Kumar', phone: '+91 98765 43210', vehicleId: 'veh-1' },
    { id: 'usr-3', name: 'Suresh Raina', phone: '+91 97654 32109', vehicleId: 'veh-2' },
    { id: 'usr-4', name: 'Kumar Logan', phone: '+91 96543 21098', vehicleId: 'veh-3' }
  ],
  vehicles: [
    { id: 'veh-1', vehicleNo: 'TN-01-AX-1234', capacity: 500, status: 'Available', warehouseId: 'wh-1', driverId: 'usr-2', latitude: 13.0827, longitude: 80.2707 },
    { id: 'veh-2', vehicleNo: 'TN-09-BY-5678', capacity: 800, status: 'Available', warehouseId: 'wh-2', driverId: 'usr-3', latitude: 13.0067, longitude: 80.2206 },
    { id: 'veh-3', vehicleNo: 'TN-07-CZ-9012', capacity: 300, status: 'Available', warehouseId: 'wh-1', driverId: 'usr-4', latitude: 13.0827, longitude: 80.2707 }
  ],
  customers: [
    { id: 'cust-1', name: 'Mylapore Retailers', latitude: 13.0330, longitude: 80.2690, address: 'Mylapore, Chennai', priority: 'High' },
    { id: 'cust-2', name: 'Nungambakkam Supermarket', latitude: 13.0600, longitude: 80.2400, address: 'Nungambakkam, Chennai', priority: 'Medium' },
    { id: 'cust-3', name: 'Adyar Logistics Depot', latitude: 12.9982, longitude: 80.2564, address: 'Adyar, Chennai', priority: 'Medium' },
    { id: 'cust-4', name: 'Velachery Bazaar', latitude: 12.9796, longitude: 80.2245, address: 'Velachery, Chennai', priority: 'Low' },
    { id: 'cust-5', name: 'Anna Nagar Mall', latitude: 13.0850, longitude: 80.2100, address: 'Anna Nagar, Chennai', priority: 'High' },
    { id: 'cust-6', name: 'T-Nagar Plaza Store', latitude: 13.0418, longitude: 80.2337, address: 'T-Nagar, Chennai', priority: 'High' }
  ],
  orders: [
    { id: 'ord-1', customerId: 'cust-1', warehouseId: 'wh-1', vehicleId: 'veh-1', status: 'Pending', size: 150, deadline: '3 Hours', createdAt: new Date().toISOString(), path: [] },
    { id: 'ord-2', customerId: 'cust-3', warehouseId: 'wh-2', vehicleId: 'veh-2', status: 'Pending', size: 220, deadline: '5 Hours', createdAt: new Date().toISOString(), path: [] },
    { id: 'ord-3', customerId: 'cust-4', warehouseId: 'wh-2', vehicleId: 'veh-2', status: 'Pending', size: 80,  deadline: '8 Hours', createdAt: new Date().toISOString(), path: [] },
    { id: 'ord-4', customerId: 'cust-6', warehouseId: 'wh-1', vehicleId: 'veh-3', status: 'Pending', size: 210, deadline: '2 Hours', createdAt: new Date().toISOString(), path: [] }
  ],
  trafficEvents: [],
  vehicleEvents: []
};

// Global in-memory cache
let dataCache = null;

const loadData = () => {
  if (dataCache) return dataCache;

  try {
    if (fs.existsSync(DATA_FILE)) {
      const info = fs.readFileSync(DATA_FILE, 'utf8');
      dataCache = JSON.parse(info);
      // Ensure all root structures exist
      for (const key in defaultData) {
        if (!dataCache[key]) {
          dataCache[key] = defaultData[key];
        }
      }
      return dataCache;
    }
  } catch (error) {
    console.error('Error reading JSON DB file, using default seed:', error);
  }

  dataCache = JSON.parse(JSON.stringify(defaultData));
  saveData(dataCache);
  return dataCache;
};

const saveData = (data) => {
  dataCache = data;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing to JSON DB file:', error);
  }
};

export const db = {
  // Users
  users: {
    find: () => {
      const d = loadData();
      return d.users;
    },
    findOne: (query) => {
      const d = loadData();
      return d.users.find(u => {
        return Object.entries(query).every(([k, v]) => u[k] === v);
      });
    },
    create: (user) => {
      const d = loadData();
      const newUser = { id: `usr-${Date.now()}`, ...user };
      d.users.push(newUser);
      saveData(d);
      return newUser;
    }
  },

  // Warehouses
  warehouses: {
    find: () => loadData().warehouses,
    findOne: (id) => loadData().warehouses.find(w => w.id === id),
    create: (wh) => {
      const d = loadData();
      const newWh = { id: `wh-${Date.now()}`, ...wh };
      d.warehouses.push(newWh);
      saveData(d);
      return newWh;
    },
    update: (id, whData) => {
      const d = loadData();
      const idx = d.warehouses.findIndex(w => w.id === id);
      if (idx !== -1) {
        d.warehouses[idx] = { ...d.warehouses[idx], ...whData };
        saveData(d);
        return d.warehouses[idx];
      }
      return null;
    },
    delete: (id) => {
      const d = loadData();
      d.warehouses = d.warehouses.filter(w => w.id !== id);
      saveData(d);
      return true;
    }
  },

  // Drivers
  drivers: {
    find: () => loadData().drivers,
    findOne: (id) => loadData().drivers.find(d => d.id === id),
    create: (drv) => {
      const d = loadData();
      const newDrv = { ...drv };
      d.drivers.push(newDrv);
      saveData(d);
      return newDrv;
    },
    update: (id, drvData) => {
      const d = loadData();
      const idx = d.drivers.findIndex(x => x.id === id);
      if (idx !== -1) {
        d.drivers[idx] = { ...d.drivers[idx], ...drvData };
        saveData(d);
        return d.drivers[idx];
      }
      return null;
    },
    delete: (id) => {
      const d = loadData();
      d.drivers = d.drivers.filter(x => x.id !== id);
      saveData(d);
      return true;
    }
  },

  // Vehicles
  vehicles: {
    find: () => loadData().vehicles,
    findOne: (id) => loadData().vehicles.find(v => v.id === id),
    findByDriver: (driverId) => loadData().vehicles.find(v => v.driverId === driverId),
    create: (veh) => {
      const d = loadData();
      const newVeh = { id: `veh-${Date.now()}`, latitude: 13.0827, longitude: 80.2707, ...veh };
      d.vehicles.push(newVeh);
      saveData(d);
      return newVeh;
    },
    update: (id, vehData) => {
      const d = loadData();
      const idx = d.vehicles.findIndex(v => v.id === id);
      if (idx !== -1) {
        d.vehicles[idx] = { ...d.vehicles[idx], ...vehData };
        saveData(d);
        return d.vehicles[idx];
      }
      return null;
    },
    delete: (id) => {
      const d = loadData();
      d.vehicles = d.vehicles.filter(v => v.id !== id);
      saveData(d);
      return true;
    }
  },

  // Customers
  customers: {
    find: () => loadData().customers,
    findOne: (id) => loadData().customers.find(c => c.id === id),
    create: (cust) => {
      const d = loadData();
      const newCust = { id: `cust-${Date.now()}`, ...cust };
      d.customers.push(newCust);
      saveData(d);
      return newCust;
    },
    update: (id, custData) => {
      const d = loadData();
      const idx = d.customers.findIndex(c => c.id === id);
      if (idx !== -1) {
        d.customers[idx] = { ...d.customers[idx], ...custData };
        saveData(d);
        return d.customers[idx];
      }
      return null;
    },
    delete: (id) => {
      const d = loadData();
      d.customers = d.customers.filter(c => c.id !== id);
      saveData(d);
      return true;
    }
  },

  // Orders
  orders: {
    find: () => loadData().orders,
    findOne: (id) => loadData().orders.find(o => o.id === id),
    findByVehicle: (vehicleId) => loadData().orders.filter(o => o.vehicleId === vehicleId),
    create: (ord) => {
      const d = loadData();
      const newOrd = { id: `ord-${Date.now()}`, status: 'Pending', createdAt: new Date().toISOString(), path: [], ...ord };
      d.orders.push(newOrd);
      saveData(d);
      return newOrd;
    },
    update: (id, ordData) => {
      const d = loadData();
      const idx = d.orders.findIndex(x => x.id === id);
      if (idx !== -1) {
        d.orders[idx] = { ...d.orders[idx], ...ordData };
        saveData(d);
        return d.orders[idx];
      }
      return null;
    },
    delete: (id) => {
      const d = loadData();
      d.orders = d.orders.filter(o => o.id !== id);
      saveData(d);
      return true;
    }
  },

  // Traffic Events
  trafficEvents: {
    find: () => loadData().trafficEvents,
    create: (evt) => {
      const d = loadData();
      const newEvt = { id: `trf-${Date.now()}`, createdAt: new Date().toISOString(), ...evt };
      d.trafficEvents.push(newEvt);
      saveData(d);
      return newEvt;
    },
    clear: () => {
      const d = loadData();
      d.trafficEvents = [];
      saveData(d);
      return true;
    }
  },

  // Vehicle Events (breakdowns, low fuel, driver status updates)
  vehicleEvents: {
    find: () => loadData().vehicleEvents,
    create: (evt) => {
      const d = loadData();
      const newEvt = { id: `vhe-${Date.now()}`, createdAt: new Date().toISOString(), ...evt };
      d.vehicleEvents.push(newEvt);
      saveData(d);
      return newEvt;
    },
    clear: () => {
      const d = loadData();
      d.vehicleEvents = [];
      saveData(d);
      return true;
    }
  },

  // Clear system
  resetToDefault: () => {
    saveData(defaultData);
    return defaultData;
  }
};
