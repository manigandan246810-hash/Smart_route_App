import mongoose from 'mongoose';

const quantumJobSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // custom ID like job-1
    jobId: { type: String, required: true },
    optimizerStatus: { type: String, default: 'Solved' },
    qubitCount: { type: Number, default: 0 },
    candidateRoutes: { type: Number, default: 0 },
    selectedOptimalRoute: { type: Number, default: 0 },
    distanceSaved: { type: Number, default: 0 },
    fuelSaved: { type: Number, default: 0 },
    executionTime: { type: Number, default: 0 },
    energyConvergence: { type: mongoose.Schema.Types.Mixed, default: [] },
    timestamp: { type: String, default: () => new Date().toISOString() }
}, {
    timestamps: true,
    _id: false
});

export const QuantumJob = mongoose.model('QuantumJob', quantumJobSchema);
