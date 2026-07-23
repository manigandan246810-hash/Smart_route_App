import mongoose from 'mongoose';

const vehicleBreakdownSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom ID like brk-1
    vehicleId: { type: String, required: true },
    description: { type: String, default: '' },
    severity: { type: String, default: 'High' },
    status: { type: String, default: 'Active' },
    tripId: { type: String, default: null },
    driverId: { type: String, default: null },
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    orderStatus: { type: String, default: 'Package Loaded' },
    timestamp: { type: String, default: () => new Date().toISOString() }
}, {
    timestamps: true,
    _id: false
});

export const VehicleBreakdown = mongoose.model('VehicleBreakdown', vehicleBreakdownSchema);
