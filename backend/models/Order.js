import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom ID like ord-1
    customerId: { type: String, required: true },
    warehouseId: { type: String, required: true },
    vehicleId: { type: String, default: null },
    driverId: { type: String, default: null },
    status: { type: String, default: 'Pending', enum: ['Pending', 'Dispatching', 'Assigned', 'In Transit', 'Completed', 'Rejected'] },
    priority: { type: String, default: 'Medium' },
    distance: { type: Number, default: 0 },
    eta: { type: Number, default: 0 },
    quantumStatus: { type: String, default: 'Ready' },
    size: { type: Number, default: 0 },
    deadline: { type: String, default: '' },
    actualTimeTakenMinutes: { type: Number, default: null }
}, {
    timestamps: true,
    _id: false
});

export const Order = mongoose.model('Order', orderSchema);
