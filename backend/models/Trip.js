import mongoose from 'mongoose';

const tripSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom ID like trp-1
    driverId: { type: String, required: true },
    vehicleId: { type: String, required: true },
    warehouseId: { type: String, required: true },
    orderIds: [{ type: String }],
    status: { type: String, default: 'Assigned' },
    expectedDistance: { type: Number, default: 0 },
    expectedTime: { type: Number, default: 0 },
    actualTimeTakenMinutes: { type: Number, default: null },
    routeDetails: { type: Array, default: [] },
    roadRoute: { type: Array, default: [] },
    currentRoadRouteIndex: { type: Number, default: 0 },
    jobId: { type: String, default: null },
    acceptedAt: { type: String, default: null },
    rejectedAt: { type: String, default: null },
    isPaused: { type: Boolean, default: false }
}, {
    timestamps: true,
    _id: false
});

tripSchema.index({ driverId: 1, status: 1 });
tripSchema.index({ vehicleId: 1 });

export const Trip = mongoose.model('Trip', tripSchema);
