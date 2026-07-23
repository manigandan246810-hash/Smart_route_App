import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom ID like wh-1
    name: { type: String, required: true },
    manager: { type: String, default: '' },
    address: { type: String, default: '' },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    capacity: { type: Number, default: 50000 },
    currentInventory: { type: Number, default: 0 },
    activeVehicles: { type: Number, default: 0 },
    waitingOrders: { type: Number, default: 0 },
    status: { type: String, default: 'Active' }
}, {
    timestamps: true,
    _id: false
});

export const Warehouse = mongoose.model('Warehouse', warehouseSchema);
