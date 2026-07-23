import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom ID matching user._id (e.g., usr-2)
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, default: 'driver123' }, // password stored for quick access
    phone: { type: String, default: '' },
    license: { type: String, default: 'DL-PENDING' },
    licenseExpiry: { type: String, default: '2030-01-01' },
    address: { type: String, default: 'Chennai, TN' },
    driverClass: { type: String, default: '4-Wheeler Driver' },
    vehicleId: { type: String, default: null },
    gps: {
        lat: { type: Number, default: 13.0827 },
        lng: { type: Number, default: 80.2707 }
    },
    status: { type: String, default: 'Available', enum: ['Available', 'Busy', 'Offline', 'Suspended', 'Delivering', 'Waiting', 'Returning'] },
    batteryLevel: { type: Number, default: 100 },
    networkStatus: { type: String, default: 'Excellent' },
    currentSpeed: { type: Number, default: 0 },
    activeTrip: { type: mongoose.Schema.Types.Mixed, default: null },
    score: { type: Number, default: 100 },
    completedTrips: { type: Number, default: 0 },
    cancelledTrips: { type: Number, default: 0 },
    joinedDate: { type: String, default: () => new Date().toISOString().split('T')[0] }
}, {
    timestamps: true,
    _id: false
});

driverSchema.index({ status: 1, vehicleId: 1 });
driverSchema.index({ email: 1 });

export const Driver = mongoose.model('Driver', driverSchema);
