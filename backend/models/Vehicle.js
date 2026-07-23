import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom ID like veh-1
    vehicleNo: { type: String, required: true },
    model: { type: String, required: true },
    capacity: { type: Number, default: 0 },
    status: { type: String, default: 'Available', enum: ['Available', 'Delivering', 'Maintenance', 'Breakdown', 'Disabled', 'Offline', 'Searching', 'Idle'] },
    fuel: { type: Number, default: 100 },
    maintenanceStatus: { type: String, default: 'Normal' },
    category: { type: String, default: '4-Wheeler' },
    warehouseId: { type: String, default: null },
    driverId: { type: String, default: null },
    latitude: { type: Number, default: 13.0827 },
    longitude: { type: Number, default: 80.2707 }
}, {
    timestamps: true,
    _id: false
});

export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
