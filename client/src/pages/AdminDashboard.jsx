import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import {
    Building, Truck, User, ShoppingBag, AlertTriangle,
    TrendingUp, Play, RotateCcw, Plus, X, LogOut,
    Gauge, MapPin, Bell, Shield, BarChart2, Eye, ShieldAlert,
    Edit2, Trash2, Smartphone, Battery, Signal, Zap, RefreshCw, Sun, Moon
} from 'lucide-react';
import InteractiveMap from '../components/InteractiveMap';
import { API_BASE_URL, SOCKET_URL } from '../config';

const fetch = (url, options) => {
    const targetUrl = typeof url === 'string'
        ? url.replace('http://localhost:5000', API_BASE_URL)
        : url;
    return window.fetch(targetUrl, options);
};

export default function AdminDashboard({ token, onLogout }) {
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'orders', 'drivers', 'vehicles', 'warehouses', 'quantum', 'map', 'notifications', 'reports', 'settings'

    // Theme state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        return localStorage.getItem('admin_theme') === 'dark';
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('admin_theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('admin_theme', 'light');
        }
    }, [isDarkMode]);

    // Data states
    const [warehouses, setWarehouses] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [trips, setTrips] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [notifFilterType, setNotifFilterType] = useState('All');
    const [notifFilterRead, setNotifFilterRead] = useState('All');
    const [notifSortOrder, setNotifSortOrder] = useState('desc');
    const [quantumJobs, setQuantumJobs] = useState([]);
    const [events, setEvents] = useState({ traffic: [], vehicles: [] });
    const [kpiStats, setKpiStats] = useState({
        kpis: { todayOrders: 0, pendingOrders: 0, completedOrders: 0, cancelledOrders: 0 },
        fleet: { available: 0, active: 0, maintenance: 0, onlineDrivers: 0, offlineDrivers: 0 },
        quantum: { jobsRunning: 0, jobsCompleted: 0, avgOptimizationTime: 0, distanceSaved: 0 }
    });

    const [dispatchingOrders, setDispatchingOrders] = useState({});
    const [vehicleFilter, setVehicleFilter] = useState('All');
    const [driverFilter, setDriverFilter] = useState('All');
    const [warehouseFilter, setWarehouseFilter] = useState('All');
    const [orderSortField, setOrderSortField] = useState('id');
    const [orderSortMode, setOrderSortMode] = useState('asc'); // 'asc' | 'desc'
    const [orderStatusFilter, setOrderStatusFilter] = useState('All');

    // Map variables
    const [mapMode, setMapMode] = useState('roadmap');
    const [visibleOverlays, setVisibleOverlays] = useState({
        warehouses: true,
        vehicles: true,
        drivers: true,
        customers: true,
        traffic: true,
        quantumRoute: true,
        actualRoadRoute: true
    });

    // Selection states
    const [selectedOrderForRoute, setSelectedOrderForRoute] = useState(null);
    const [currentRouteData, setCurrentRouteData] = useState(null);
    const [focusedTrip, setFocusedTrip] = useState(null);
    const [centerCoord, setCenterCoord] = useState(null);
    const [showLayerDropdown, setShowLayerDropdown] = useState(false);
    const [breakdowns, setBreakdowns] = useState([]);
    const [selectedSearchItem, setSelectedSearchItem] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState('All');
    const [isTablet, setIsTablet] = useState(window.innerWidth < 1024);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsTablet(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Modals state
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedOrderToAssign, setSelectedOrderToAssign] = useState(null);

    // Form states
    const [newOrder, setNewOrder] = useState({ customerId: '', warehouseId: '', vehicleId: '', priority: 'Medium', size: 120 });
    const [assignForm, setAssignForm] = useState({ driverId: '', vehicleId: '', warehouseId: '', overrideRules: false });

    // Modals & form states for CRUD operations
    const [showDriverModal, setShowDriverModal] = useState(false);
    const [editingDriver, setEditingDriver] = useState(null);
    const [driverForm, setDriverForm] = useState({ name: '', email: '', password: '', phone: '', license: '', licenseExpiry: '', address: '', vehicleId: '' });

    const [showWarehouseModal, setShowWarehouseModal] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState(null);
    const [warehouseForm, setWarehouseForm] = useState({ name: '', manager: '', address: '', latitude: '', longitude: '', capacity: '' });

    const [showDriverProfileModal, setShowDriverProfileModal] = useState(false);
    const [selectedProfileDriver, setSelectedProfileDriver] = useState(null);

    const [showReassignModal, setShowReassignModal] = useState(false);
    const [tripToReassign, setTripToReassign] = useState(null);
    const [reassignForm, setReassignForm] = useState({ driverId: '', vehicleId: '' });

    const [showContactModal, setShowContactModal] = useState(false);
    const [contactDriverId, setContactDriverId] = useState('');
    const [contactForm, setContactForm] = useState({ message: '', type: 'message' });

    // Helper: Enrich drivers with active trip info
    const getEnrichedDrivers = () => {
        return drivers.map(drv => {
            const activeTrip = trips.find(t => t.driverId === drv.id && (t.status === 'Active' || t.status === 'Assigned'));
            if (activeTrip) {
                const vehicle = vehicles.find(v => v.id === activeTrip.vehicleId);
                const warehouse = warehouses.find(w => w.id === activeTrip.warehouseId);
                
                const pendingOrderIds = activeTrip.orderIds.filter(oid => {
                    const o = orders.find(x => x.id === oid);
                    return o && o.status !== 'Completed';
                });
                const activeOrder = pendingOrderIds.length > 0 ? orders.find(x => x.id === pendingOrderIds[0]) : null;
                const customer = activeOrder ? customers.find(c => c.id === activeOrder.customerId) : null;
                
                const totalSteps = activeTrip.roadRoute ? activeTrip.roadRoute.length : 10;
                const currentStep = activeTrip.currentRoadRouteIndex || 0;
                const remainingFraction = Math.max(0, 1 - (currentStep / totalSteps));
                const eta = Math.ceil(activeTrip.expectedTime * remainingFraction);
                
                return {
                    ...drv,
                    vehicleNo: vehicle ? vehicle.vehicleNo : 'None',
                    activeOrderId: activeOrder ? activeOrder.id : 'None',
                    warehouseName: warehouse ? warehouse.name : 'None',
                    customerName: customer ? customer.name : 'None',
                    etaMinutes: eta,
                    lastUpdatedText: drv.updatedAt ? `${Math.floor((Date.now() - new Date(drv.updatedAt).getTime()) / 1000)} seconds ago` : 'Just now'
                };
            } else {
                return {
                    ...drv,
                    vehicleNo: 'None',
                    activeOrderId: 'None',
                    warehouseName: 'None',
                    customerName: 'None',
                    etaMinutes: 'N/A',
                    lastUpdatedText: 'N/A'
                };
            }
        });
    };

    // Driver CRUD Handlers
    const handleSaveDriver = async (e) => {
        e.preventDefault();
        const method = editingDriver ? 'PUT' : 'POST';
        const url = editingDriver ? `http://localhost:5000/api/drivers/${editingDriver.id}` : 'http://localhost:5000/api/drivers';
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(driverForm)
            });
            if (res.ok) {
                setShowDriverModal(false);
                setEditingDriver(null);
                setDriverForm({ name: '', email: '', password: '', phone: '', license: '', licenseExpiry: '', address: '', vehicleId: '' });
                fetchData();
            }
        } catch (err) { console.error(err); }
    };

    const handleDeleteDriver = async (id) => {
        if (confirm("Are you sure you want to remove this driver?")) {
            try {
                await fetch(`http://localhost:5000/api/drivers/${id}`, { method: 'DELETE' });
                fetchData();
            } catch (err) { console.error(err); }
        }
    };

    const handleToggleSuspendDriver = async (driver) => {
        const url = driver.status === 'Suspended' 
            ? `http://localhost:5000/api/drivers/${driver.id}/activate`
            : `http://localhost:5000/api/drivers/${driver.id}/suspend`;
        try {
            await fetch(url, { method: 'POST' });
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleAssignDriverVehicle = async (driverId, vehicleId) => {
        try {
            await fetch(`http://localhost:5000/api/drivers/${driverId}/assign-vehicle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicleId })
            });
            fetchData();
        } catch (err) { console.error(err); }
    };

    const handleUnassignDriverVehicle = async (driverId) => {
        try {
            await fetch(`http://localhost:5000/api/drivers/${driverId}/unassign-vehicle`, { method: 'POST' });
            fetchData();
        } catch (err) { console.error(err); }
    };

    // Warehouse CRUD Handlers
    const handleSaveWarehouse = async (e) => {
        e.preventDefault();
        const method = editingWarehouse ? 'PUT' : 'POST';
        const url = editingWarehouse ? `http://localhost:5000/api/warehouses/${editingWarehouse.id}` : 'http://localhost:5000/api/warehouses';
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(warehouseForm)
            });
            if (res.ok) {
                setShowWarehouseModal(false);
                setEditingWarehouse(null);
                setWarehouseForm({ name: '', manager: '', address: '', latitude: '', longitude: '', capacity: '' });
                fetchData();
            }
        } catch (err) { console.error(err); }
    };

    const handleDeleteWarehouse = async (id) => {
        if (confirm("Are you sure you want to delete this warehouse depot?")) {
            try {
                await fetch(`http://localhost:5000/api/warehouses/${id}`, { method: 'DELETE' });
                fetchData();
            } catch (err) { console.error(err); }
        }
    };

    // Live Delivery Administrative Overrides
    const handleCancelTrip = async (tripId) => {
        if (confirm("Are you sure you want to CANCEL this delivery and release the vehicles/drivers?")) {
            try {
                await fetch(`http://localhost:5000/api/trips/${tripId}/cancel`, { method: 'POST' });
                setFocusedTrip(null);
                fetchData();
            } catch (err) { console.error(err); }
        }
    };

    const handleTogglePauseTrip = async (trip) => {
        const action = trip.isPaused ? 'resume' : 'pause';
        try {
            await fetch(`http://localhost:5000/api/trips/${trip.id}/${action}`, { method: 'POST' });
            fetchData();
            if (focusedTrip && focusedTrip.id === trip.id) {
                setFocusedTrip(prev => ({ ...prev, isPaused: !prev.isPaused }));
            }
        } catch (err) { console.error(err); }
    };

    const handleReassignTripSubmit = async (e) => {
        e.preventDefault();
        if (!tripToReassign) return;
        try {
            const res = await fetch(`http://localhost:5000/api/trips/${tripToReassign.id}/reassign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    newDriverId: reassignForm.driverId,
                    newVehicleId: reassignForm.vehicleId
                })
            });
            if (res.ok) {
                setShowReassignModal(false);
                setTripToReassign(null);
                fetchData();
            } else {
                const err = await res.json();
                alert(err.message || "Failed to reassign trip.");
            }
        } catch (err) { console.error(err); }
    };

    const handleSendContactMessage = async (e) => {
        e.preventDefault();
        const action = contactForm.type === 'emergency' ? 'emergency' : 'contact';
        try {
            await fetch(`http://localhost:5000/api/drivers/${contactDriverId}/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: contactForm.message })
            });
            setShowContactModal(false);
            setContactForm({ message: '', type: 'message' });
            alert("Broadcast message transmitted!");
        } catch (err) { console.error(err); }
    };

    // Fetch KPI statistics and list entities
    const fetchData = async () => {
        try {
            const kpiRes = await fetch('http://localhost:5000/api/reports/kpis');
            if (kpiRes.ok) setKpiStats(await kpiRes.json());

            const whRes = await fetch('http://localhost:5000/api/warehouses');
            if (whRes.ok) setWarehouses(await whRes.json());

            const custRes = await fetch('http://localhost:5000/api/customers');
            if (custRes.ok) setCustomers(await custRes.json());

            const vehRes = await fetch('http://localhost:5000/api/vehicles');
            if (vehRes.ok) setVehicles(await vehRes.json());

            const drvRes = await fetch('http://localhost:5000/api/drivers');
            if (drvRes.ok) setDrivers(await drvRes.json());

            const ordRes = await fetch('http://localhost:5000/api/orders');
            if (ordRes.ok) setOrders(await ordRes.json());

            const trRes = await fetch('http://localhost:5000/api/trips');
            if (trRes.ok) setTrips(await trRes.json());

            const notRes = await fetch('http://localhost:5000/api/notifications');
            if (notRes.ok) setNotifications(await notRes.json());

            const brkRes = await fetch('http://localhost:5000/api/breakdowns');
            if (brkRes.ok) setBreakdowns(await brkRes.json());

            const trfRes = await fetch('http://localhost:5000/api/events/traffic');
            if (trfRes.ok) {
                const trfData = await trfRes.json();
                setEvents(prev => ({ ...prev, traffic: trfData }));
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 4000);

        const socket = io(SOCKET_URL);
        socket.emit('join', { role: 'admin' });

        const handleDriverLocation = (data) => {
            if (!data || !data.driverId || !data.gps) return;
            setDrivers(prev => prev.map(d => {
                if (d.id !== data.driverId) return d;
                return {
                    ...d,
                    gps: data.gps,
                    bearing: data.bearing !== undefined ? data.bearing : (d.bearing || 0),
                    currentSpeed: data.speed !== undefined ? data.speed : d.currentSpeed,
                    batteryLevel: data.batteryLevel !== undefined ? data.batteryLevel : d.batteryLevel,
                    networkStatus: data.networkStatus || d.networkStatus,
                    lastSyncTimestamp: data.serverTimestamp || Date.now(),
                    updatedAt: new Date().toISOString()
                };
            }));
        };

        socket.on('driver:location_update', handleDriverLocation);
        socket.on('driver:location_changed', handleDriverLocation);

        socket.on('route:rerouted', (data) => {
            setTrips(prev => prev.map(t => t.id === data.tripId ? {
                ...t,
                roadRoute: data.roadRoute,
                expectedTime: data.expectedTime,
                updatedAt: new Date().toISOString()
            } : t));
        });

        socket.on('dispatch:admin_notified', (data) => {
            setDispatchingOrders(prev => ({
                ...prev,
                [data.orderId]: data.rankedDrivers
            }));
        });

        socket.on('dispatch:accepted', (data) => {
            setDispatchingOrders(prev => {
                const copy = { ...prev };
                delete copy[data.orderId];
                return copy;
            });
            fetchData();
        });

        socket.on('dispatch:recovery_admin_notified', (data) => {
            fetchData();
        });

        socket.on('dispatch:recovery_accepted', (data) => {
            fetchData();
        });

        socket.on('events:sos_updated', (data) => {
            fetchData();
        });

        socket.on('system:reset', () => {
            fetchData();
        });

        return () => {
            clearInterval(interval);
            socket.disconnect();
        };
    }, []);

    // Fetch optimizer routes logic
    const handleViewRoute = async (order) => {
        try {
            setSelectedOrderForRoute(order);
            const res = await fetch(`http://localhost:5000/api/quantum/compare?warehouseId=${order.warehouseId}&vehicleId=${order.vehicleId}`);
            if (res.ok) {
                const data = await res.json();
                setCurrentRouteData(data);
                setActiveTab('map'); // Switch to map
            } else {
                alert("Could not load optimization routes.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Open Assign popup
    const handleOpenAssign = (order) => {
        setSelectedOrderToAssign(order);
        setAssignForm({
            driverId: order.driverId || '',
            vehicleId: order.vehicleId || '',
            warehouseId: order.warehouseId || warehouses[0]?.id || ''
        });
        setShowAssignModal(true);
    };

    // Execute Quantum Assignment workflow
    const handleExecuteAssignment = async (e) => {
        e.preventDefault();
        if (!selectedOrderToAssign) return;
        try {
            const res = await fetch('http://localhost:5000/api/trips/assign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    driverId: assignForm.driverId,
                    vehicleId: assignForm.vehicleId,
                    warehouseId: assignForm.warehouseId,
                    orderIds: [selectedOrderToAssign.id]
                })
            });

            if (res.ok) {
                alert("Quantum Route Optimized! Push notification dispatched to driver's mobile alert portal.");
                setShowAssignModal(false);
                fetchData();
            } else {
                const err = await res.json();
                alert(err.message || "Failed to assign trip.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Create order
    const handleCreateOrder = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:5000/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newOrder)
            });
            if (res.ok) {
                setShowOrderModal(false);
                fetchData();
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Delete Order
    const handleDeleteOrder = async (id) => {
        if (confirm("Cancel and delete this order?")) {
            try {
                await fetch(`http://localhost:5000/api/orders/${id}`, { method: 'DELETE' });
                fetchData();
            } catch (e) {
                console.error(e);
            }
        }
    };

    // Start delivery dispatch flow (notifying closest available drivers)
    const handleStartDelivery = async (id) => {
        try {
            const res = await fetch(`http://localhost:5000/api/orders/${id}/start-delivery`, { method: 'POST' });
            if (res.ok) {
                fetchData();
            } else {
                alert("Failed to initiate delivery dispatch.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Toggle SOS Zone bypass constraints on a traffic congestion event
    const handleToggleSOSZone = async (id) => {
        try {
            const res = await fetch(`http://localhost:5000/api/events/traffic/${id}/toggle-sos`, { method: 'POST' });
            if (res.ok) {
                fetchData();
            } else {
                alert("Failed to toggle SOS Zone status.");
            }
        } catch (e) {
            console.error(e);
        }
    };

    // Restore a broken down vehicle carrier to active service
    const handleRestoreVehicle = async (breakdownId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/breakdowns/${breakdownId}/resolve-admin`, {
                method: 'POST'
            });
            if (res.ok) {
                alert("Vehicle carrier brought back to life successfully!");
                fetchData();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.message || "Failed to restore vehicle carrier.");
            }
        } catch (err) {
            console.error("Error restoring vehicle:", err);
        }
    };

    // Restore a specific vehicle asset directly to live service
    const handleRestoreVehicleById = async (vehicleId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/vehicles/${vehicleId}/restore`, {
                method: 'POST'
            });
            if (res.ok) {
                alert("Vehicle carrier restored to live state successfully!");
                fetchData();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert(errData.message || "Failed to restore vehicle.");
            }
        } catch (err) {
            console.error("Error restoring vehicle by ID:", err);
        }
    };

    // Restore all delivered orders to undelivered (Pending) status
    const handleResetDeliveredOrders = async () => {
        if (confirm("Are you sure you want to restore ALL delivered orders back to undelivered (Pending) status?")) {
            try {
                const res = await fetch('http://localhost:5000/api/orders/reset-delivered', {
                    method: 'POST'
                });
                if (res.ok) {
                    const data = await res.json();
                    alert(data.message || "All delivered orders brought back to undelivered status successfully!");
                    fetchData();
                } else {
                    const errData = await res.json().catch(() => ({}));
                    alert(errData.message || "Failed to reset delivered orders.");
                }
            } catch (err) {
                console.error("Error resetting delivered orders:", err);
            }
        }
    };

    // Pause / Resume Order simulating lock state
    const handleUpdateStatus = async (id, status) => {
        try {
            await fetch(`http://localhost:5000/api/orders/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    // Trigger simulated events
    const handleTriggerTraffic = async () => {
        const randomOffsetLat = (Math.random() - 0.5) * 0.05;
        const randomOffsetLng = (Math.random() - 0.5) * 0.05;
        const lat = 13.045 + randomOffsetLat;
        const lng = 80.25 + randomOffsetLng;

        try {
            await fetch('http://localhost:5000/api/events/traffic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    latitude: Number(lat.toFixed(5)),
                    longitude: Number(lng.toFixed(5)),
                    severity: 'High',
                    description: 'Intense commuter block on central bypass segment.'
                })
            });
            fetchData();
            alert("Traffic block added! Affected routes re-computing via Quantum solver.");
        } catch (e) {
            console.error(e);
        }
    };

    const handleClearAnomalies = async () => {
        try {
            await fetch('http://localhost:5000/api/events/clear', { method: 'POST' });
            fetchData();
            alert("All traffic delays and breakdown holds cleared!");
        } catch (e) {
            console.error(e);
        }
    };

    // Ticks
    const handleSimulateTick = async () => {
        try {
            await fetch('http://localhost:5000/api/simulation/tick', { method: 'POST' });
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    // Clear notify histories
    const handleClearNotifications = async () => {
        try {
            await fetch('http://localhost:5000/api/notifications/read', { method: 'POST' });
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)', fontFamily: 'var(--font-body)', position: 'relative' }}>

            {/* ------ TABLET OVERLAY BACKDROP ------ */}
            {isTablet && sidebarOpen && (
                <div 
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(15,23,42,0.3)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 1099
                    }}
                />
            )}

            {/* ------ LEFT SIDEBAR ------ */}
            <div style={{
                width: '260px',
                backgroundColor: 'var(--bg-secondary)',
                borderRight: '1px solid var(--panel-border)',
                display: 'flex',
                flexDirection: 'column',
                padding: '1.25rem 0',
                position: isTablet ? 'fixed' : 'static',
                top: 0,
                left: isTablet ? (sidebarOpen ? '0' : '-260px') : '0',
                height: isTablet ? '100vh' : 'auto',
                zIndex: 1100,
                transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}>
                {/* Sidebar Logo */}
                <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', borderBottom: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Truck className="glow-text-cyan" size={22} />
                    <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)', margin: 0, fontWeight: 700 }}>
                        SmartRoute <span className="glow-text-cyan">Quantum</span>
                    </h2>
                </div>

                {/* Navigation list */}
                <div style={{ flex: 1, padding: '1rem' }}>
                    {[
                        { id: 'dashboard', name: 'Dashboard', icon: <Gauge size={16} /> },
                        { id: 'orders', name: 'Orders', icon: <ShoppingBag size={16} /> },
                        { id: 'drivers', name: 'Drivers', icon: <User size={16} /> },
                        { id: 'vehicles', name: 'Vehicles', icon: <Truck size={16} /> },
                        { id: 'warehouses', name: 'Warehouses', icon: <Building size={16} /> },
                        { id: 'quantum', name: 'Quantum Optimizer', icon: <Zap size={16} /> },
                        { id: 'map', name: 'Live Map', icon: <MapPin size={16} /> },
                        { id: 'notifications', name: 'Notifications', icon: <Bell size={16} />, badge: notifications.filter(n => !n.read).length },
                        { id: 'reports', name: 'Reports', icon: <BarChart2 size={16} /> },
                        { id: 'settings', name: 'Settings', icon: <Shield size={16} /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id);
                                if (isTablet) setSidebarOpen(false);
                            }}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '0.75rem 1rem',
                                backgroundColor: activeTab === tab.id ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                                border: 'none',
                                color: activeTab === tab.id ? 'var(--quantum-cyan)' : 'var(--text-muted)',
                                borderRadius: '8px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                marginBottom: '0.35rem',
                                position: 'relative'
                            }}
                        >
                            {tab.icon}
                            <span>{tab.name}</span>
                            {tab.badge > 0 && (
                                <span style={{ position: 'absolute', right: '12px', background: '#ef4444', color: '#fff', fontSize: '10px', padding: '2px 6px', borderRadius: '50%' }}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Sidebar Footer */}
                <div style={{ padding: '0 1rem' }}>
                    <button className="btn btn-secondary" onClick={onLogout} style={{ width: '100%', justifyContent: 'flex-start' }}>
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </div>

            {/* ------ CONTENT AREA ------ */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>

                {/* Top Header */}
                <div style={{
                    height: '64px',
                    borderBottom: '1px solid var(--panel-border)',
                    padding: isTablet ? '0 1.25rem' : '0 2rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-secondary)',
                    flexShrink: 0
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isTablet && (
                            <button 
                                className="btn btn-secondary" 
                                style={{ padding: '6px 12px', fontSize: '1rem', border: '1px solid var(--panel-border)' }}
                                onClick={() => setSidebarOpen(!sidebarOpen)}
                            >
                                ☰
                            </button>
                        )}
                        <h3 style={{ textTransform: 'capitalize', margin: 0, fontSize: '1.15rem' }}>{activeTab} Module</h3>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <button
                            onClick={() => setIsDarkMode(!isDarkMode)}
                            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                borderRadius: '8px',
                                border: '1px solid var(--panel-border)',
                                backgroundColor: 'var(--bg-tertiary)',
                                color: 'var(--text-main)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {isDarkMode ? <Sun size={15} color="#facc15" /> : <Moon size={15} color="#64748b" />}
                            <span>{isDarkMode ? 'Light' : 'Dark'} Mode</span>
                        </button>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>User: <strong style={{ color: 'var(--text-main)' }}>Admin System</strong></div>
                    </div>
                </div>

                {/* Content body */}
                <div style={{ padding: '2rem', flex: 1 }}>

                    {/* ================== TAB: DASHBOARD ================== */}
                    {activeTab === 'dashboard' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                            {/* KPI Cards */}
                            <div>
                                <h4 style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Key Performance Indicators</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
                                    <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '3px solid var(--quantum-blue)', cursor: 'pointer' }} onClick={() => setActiveTab('orders')}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Today's Orders</div>
                                        <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{kpiStats.kpis?.todayOrders}</div>
                                    </div>
                                    <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '3px solid var(--warning-yellow)', cursor: 'pointer' }} onClick={() => setActiveTab('orders')}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Pending Orders</div>
                                        <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{kpiStats.kpis?.pendingOrders}</div>
                                    </div>
                                    <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '3px solid var(--success-green)', cursor: 'pointer' }} onClick={() => setActiveTab('orders')}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Completed Orders</div>
                                        <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{kpiStats.kpis?.completedOrders}</div>
                                    </div>
                                    <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '3px solid var(--danger-red)', cursor: 'pointer' }} onClick={() => setActiveTab('orders')}>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>Cancelled Orders</div>
                                        <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{kpiStats.kpis?.cancelledOrders}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Grid 2-col Fleet & Warehouse & Quantum Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

                                {/* Fleet status card */}
                                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Truck size={18} /> Fleet status</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                        <div style={{ background: 'var(--panel-bg)', padding: '0.75rem', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{kpiStats.fleet?.available} / {kpiStats.fleet?.available + kpiStats.fleet?.active}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vehicles Available</div>
                                        </div>
                                        <div style={{ background: 'var(--panel-bg)', padding: '0.75rem', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--danger-red)' }}>{kpiStats.fleet?.maintenance}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Under Maintenance</div>
                                        </div>
                                        <div style={{ background: 'var(--panel-bg)', padding: '0.75rem', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success-green)' }}>{kpiStats.fleet?.onlineDrivers}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drivers Online</div>
                                        </div>
                                        <div style={{ background: 'var(--panel-bg)', padding: '0.75rem', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-muted)' }}>{kpiStats.fleet?.offlineDrivers}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Drivers Offline</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Quantum optimization statistics */}
                                <div className="glass-panel-quantum" style={{ padding: '1.5rem' }}>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Zap size={18} className="glow-text-quantum" /> Quantum Engine Statistics</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                        <div style={{ background: 'rgba(168,85,247,0.04)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.1)' }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }} className="glow-text-quantum">
                                                {kpiStats.quantum?.jobsRunning > 0 ? 'Active' : 'Standby'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Optimization Status</div>
                                        </div>
                                        <div style={{ background: 'rgba(168,85,247,0.04)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.1)' }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{kpiStats.quantum?.jobsCompleted}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quantum Jobs Completed</div>
                                        </div>
                                        <div style={{ background: 'rgba(168,85,247,0.04)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(168,85,247,0.1)' }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{kpiStats.quantum?.avgOptimizationTime} ms</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Average Job Runtime</div>
                                        </div>
                                        <div style={{ background: 'rgba(16,185,129,0.08)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
                                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success-green)' }}>{kpiStats.quantum?.distanceSaved} km</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cumulative Distance Saved</div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                            {/* Bottom activity log feed */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem' }}>
                                {/* Left Column: Special SOS alerts and Vehicle Breakdowns */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    
                                    {/* SOS Alerts panel */}
                                    <div className="glass-panel" style={{ padding: '1.25rem' }}>
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}><ShieldAlert size={18} style={{ color: '#ef4444' }} /> Special SOS Route Notifications</h4>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Urgent route blocks. Enable SOS to re-route via the Quantum engine.</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '1rem' }}>
                                            {events.traffic.filter(t => t.isSOSZone).length === 0 ? (
                                                <div style={{ padding: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--panel-border)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    No active SOS routes. Enable SOS on traffic segments to trigger bypass.
                                                </div>
                                            ) : (
                                                events.traffic.filter(t => t.isSOSZone).map(t => (
                                                    <div key={t.id} style={{ padding: '0.65rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <span style={{ color: 'var(--danger-red)', fontWeight: 700 }}>🚨 SOS ZONE: </span>
                                                            <span style={{ color: 'var(--text-main)' }}>{t.description || 'Blocked road'} ({t.latitude}, {t.longitude})</span>
                                                        </div>
                                                        <button 
                                                            className="btn btn-secondary" 
                                                            style={{ padding: '3px 8px', fontSize: '0.7rem', borderColor: '#ef4444', color: '#ef4444' }}
                                                            onClick={() => handleToggleSOSZone(t.id)}
                                                        >
                                                            Disable SOS Route
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Inactive or general traffic segments that can be escalated to SOS */}
                                        {events.traffic.filter(t => !t.isSOSZone).length > 0 && (
                                            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--panel-border)', paddingTop: '1rem' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>General Traffic Segments (Escalate to SOS)</span>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '0.5rem' }}>
                                                    {events.traffic.filter(t => !t.isSOSZone).map(t => (
                                                        <div key={t.id} style={{ padding: '0.5rem', background: 'rgba(245,158,11,0.02)', border: '1px solid rgba(245, 158, 11, 0.05)', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <span style={{ color: 'var(--text-muted)' }}>⚠️ {t.description || 'Commuter traffic'} ({t.latitude}, {t.longitude})</span>
                                                            <button 
                                                                className="btn btn-secondary" 
                                                                style={{ padding: '2px 6px', fontSize: '0.65rem', borderColor: '#10b981', color: '#10b981' }}
                                                                onClick={() => handleToggleSOSZone(t.id)}
                                                            >
                                                                Enable SOS
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Breakdown Vehicle Notification Tab */}
                                    <div className="glass-panel" style={{ padding: '1.25rem' }}>
                                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}><AlertTriangle size={18} style={{ color: '#f59e0b' }} /> Vehicle Breakdown & Recovery Alerts</h4>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active vehicle distress logs. Click restore to clear maintenance locks.</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '1rem' }}>
                                            {breakdowns.filter(b => b.status === 'Active').length === 0 ? (
                                                <div style={{ padding: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--panel-border)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    No active vehicle breakdowns reported. System operating normally.
                                                </div>
                                            ) : (
                                                breakdowns.filter(b => b.status === 'Active').map(b => {
                                                    const veh = vehicles.find(v => v.id === b.vehicleId);
                                                    const drv = drivers.find(d => d.id === b.driverId);
                                                    return (
                                                        <div key={b.id} style={{ padding: '0.65rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div>
                                                                <span style={{ color: '#f59e0b', fontWeight: 700 }}>🔧 BREAKDOWN: </span>
                                                                <span style={{ color: 'var(--text-main)' }}>{veh ? veh.vehicleNo : b.vehicleId} ({drv ? drv.name : 'Unknown'}) - {b.description}</span>
                                                            </div>
                                                            <button 
                                                                className="btn btn-secondary" 
                                                                style={{ padding: '3px 8px', fontSize: '0.7rem', borderColor: '#10b981', color: '#10b981' }}
                                                                onClick={() => handleRestoreVehicle(b.id)}
                                                            >
                                                                Bring Back to Live
                                                            </button>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Normal Notifications (Separated Feed) */}
                                <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '420px' }}>
                                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}><Bell size={18} style={{ color: '#06b6d4' }} /> General Activity Log</h4>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Standard event telemetry & optimization registers.</span>
                                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '1rem', paddingRight: '4px' }}>
                                        {notifications.filter(n => n.type !== 'Alert' && !n.title.toLowerCase().includes('breakdown') && !n.title.toLowerCase().includes('sos')).length === 0 ? (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No activity notifications.</span>
                                        ) : (
                                            notifications.filter(n => n.type !== 'Alert' && !n.title.toLowerCase().includes('breakdown') && !n.title.toLowerCase().includes('sos')).slice(0, 30).map(n => (
                                                <div key={n.id || n._id} style={{ padding: '8px', background: 'rgba(255,255,255,0.01)', borderLeft: '2px solid rgba(6,182,212,0.3)', borderRadius: '4px', fontSize: '0.75rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9ca3af', marginBottom: '2px' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{n.title}</span>
                                                        <span>{n.timestamp ? new Date(n.timestamp).toLocaleTimeString() : ''}</span>
                                                    </div>
                                                    <span style={{ color: 'var(--text-muted)' }}>{n.message}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ================== TAB: ORDERS ================== */}
                    {activeTab === 'orders' && (
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                <h4 style={{ margin: 0 }}>Active Orders Log</h4>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    {/* Status Filter */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Filter Status:</span>
                                        <select
                                            value={orderStatusFilter}
                                            onChange={e => setOrderStatusFilter(e.target.value)}
                                            style={{ width: '145px', padding: '4px 8px', fontSize: '0.8rem', marginBottom: 0 }}
                                        >
                                            <option value="All">All Statuses</option>
                                            <option value="Pending">Pending (Undelivered)</option>
                                            <option value="In Transit">In Transit</option>
                                            <option value="Dispatching">Dispatching</option>
                                            <option value="Completed">Completed (Delivered)</option>
                                        </select>
                                    </div>

                                    {/* Sort By Field */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Sort By:</span>
                                        <select
                                            value={orderSortField}
                                            onChange={e => setOrderSortField(e.target.value)}
                                            style={{ width: '125px', padding: '4px 8px', fontSize: '0.8rem', marginBottom: 0 }}
                                        >
                                            <option value="id">Order ID</option>
                                            <option value="priority">Priority</option>
                                            <option value="size">Payload Size</option>
                                            <option value="status">Status</option>
                                            <option value="eta">ETA</option>
                                        </select>
                                    </div>

                                    {/* Sort Mode (Ascending / Descending) */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Order Mode:</span>
                                        <select
                                            value={orderSortMode}
                                            onChange={e => setOrderSortMode(e.target.value)}
                                            style={{ width: '150px', padding: '4px 8px', fontSize: '0.8rem', marginBottom: 0 }}
                                        >
                                            <option value="asc">Ascending (A-Z ⬆️)</option>
                                            <option value="desc">Descending (Z-A ⬇️)</option>
                                        </select>
                                    </div>

                                    {/* Restore Delivered Orders Button */}
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: '#f59e0b', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}
                                        onClick={handleResetDeliveredOrders}
                                        title="Restore all delivered orders to undelivered status"
                                    >
                                        <RotateCcw size={14} /> Restore Delivered to Undelivered
                                    </button>

                                    {/* Create Order Button */}
                                    <button className="btn btn-primary" onClick={() => setShowOrderModal(true)}>
                                        <Plus size={16} /> Create Order
                                    </button>
                                </div>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--panel-border)', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '10px' }}>Order ID</th>
                                            <th style={{ padding: '10px' }}>Customer</th>
                                            <th style={{ padding: '10px' }}>Source Depot</th>
                                            <th style={{ padding: '10px' }}>Vehicle</th>
                                            <th style={{ padding: '10px' }}>Priority</th>
                                            <th style={{ padding: '10px' }}>Size</th>
                                            <th style={{ padding: '10px' }}>Status</th>
                                            <th style={{ padding: '10px' }}>Opt Status</th>
                                            <th style={{ padding: '10px' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders
                                            .filter(o => {
                                                if (orderStatusFilter === 'All') return true;
                                                return o.status === orderStatusFilter;
                                            })
                                            .sort((a, b) => {
                                                let valA = a[orderSortField] ?? '';
                                                let valB = b[orderSortField] ?? '';

                                                if (orderSortField === 'size' || orderSortField === 'eta' || orderSortField === 'distance') {
                                                    valA = Number(valA) || 0;
                                                    valB = Number(valB) || 0;
                                                } else if (orderSortField === 'priority') {
                                                    const pMap = { High: 3, Medium: 2, Low: 1 };
                                                    valA = pMap[valA] || 0;
                                                    valB = pMap[valB] || 0;
                                                } else {
                                                    valA = String(valA).toLowerCase();
                                                    valB = String(valB).toLowerCase();
                                                }

                                                if (valA < valB) return orderSortMode === 'asc' ? -1 : 1;
                                                if (valA > valB) return orderSortMode === 'asc' ? 1 : -1;
                                                return 0;
                                            })
                                            .map(o => {
                                            const customerName = customers.find(c => c.id === o.customerId)?.name || 'Unknown';
                                            const warehouseName = warehouses.find(w => w.id === o.warehouseId)?.name || 'Unknown';
                                            const vehicleNo = vehicles.find(v => v.id === o.vehicleId)?.vehicleNo || 'Unassigned';

                                            return (
                                                <tr key={o.id} style={{ borderBottom: '1px solid var(--panel-border)', hover: { background: 'rgba(255,255,255,0.01)' } }}>
                                                    <td style={{ padding: '12px 10px', color: '#06b6d4', fontWeight: 600 }}>{o.id}</td>
                                                    <td style={{ padding: '12px 10px' }}>
                                                        <div>{customerName}</div>
                                                        {dispatchingOrders[o.id] && (
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', maxWidth: '200px' }}>
                                                                <div style={{ fontWeight: 700, marginBottom: '2px', color: 'var(--quantum-cyan)' }}>Notified Drivers (Real-Time):</div>
                                                                {dispatchingOrders[o.id].slice(0, 3).map((rd, i) => (
                                                                    <div key={i}>{rd.priority} Rank {rd.rank}: {rd.name} ({rd.totalDistance} km)</div>
                                                                ))}
                                                                {dispatchingOrders[o.id].length > 3 && <div>+ {dispatchingOrders[o.id].length - 3} more...</div>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 10px' }}>{warehouseName}</td>
                                                    <td style={{ padding: '12px 10px' }}>{vehicleNo}</td>
                                                    <td style={{ padding: '12px 10px' }}>
                                                        <span className={`badge badge-${o.priority?.toLowerCase()}`}>{o.priority}</span>
                                                    </td>
                                                    <td style={{ padding: '12px 10px' }}>{o.size} kg</td>
                                                    <td style={{ padding: '12px 10px' }}>
                                                        <span style={{
                                                            color: o.status === 'Completed' ? '#10b981' : (o.status === 'Pending' ? '#f59e0b' : '#3b82f6')
                                                        }}>
                                                            <span className={`dot dot-${o.status === 'Completed' ? 'green' : (o.status === 'Pending' ? 'yellow' : (o.status === 'Dispatching' ? 'yellow' : 'red'))}`} /> {o.status}
                                                        </span>
                                                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>
                                                            {o.status === 'Completed' ? (
                                                                <span>Delivered: <b>{o.actualTimeTakenMinutes || o.eta}m</b></span>
                                                            ) : (
                                                                <span>ETA: <b>{o.eta}m</b></span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 10px', color: '#3b82f6', fontWeight: 600 }}>
                                                        {o.quantumStatus === 'Optimized' ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Zap size={12} className="glow-text-quantum" /> Quantum</span>
                                                        ) : 'Classical'}
                                                    </td>
                                                    <td style={{ padding: '12px 10px' }}>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            {o.status === 'Pending' && (
                                                                <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }} onClick={() => handleStartDelivery(o.id)}>
                                                                    <Play size={10} /> Start Delivery
                                                                </button>
                                                            )}
                                                            {o.status === 'Dispatching' && (
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--warning-yellow)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <RefreshCw size={10} className="animate-spin" /> Broadcast sent...
                                                                </span>
                                                            )}
                                                            {o.status !== 'Pending' && o.status !== 'Dispatching' && (
                                                                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} title="Reassign/Assign Driver" disabled={o.status === 'Completed'} onClick={() => handleOpenAssign(o)}>
                                                                    <User size={12} />
                                                                </button>
                                                            )}
                                                            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} title="View Route" onClick={() => handleViewRoute(o)}>
                                                                <Eye size={12} />
                                                            </button>
                                                            <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }} onClick={() => handleDeleteOrder(o.id)}>
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}                    {/* ================== TAB: DRIVERS ================== */}
                    {activeTab === 'drivers' && (
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                                <h4 style={{ margin: 0 }}>Driver Roster & Profiles</h4>
                                <button className="btn btn-primary" onClick={() => {
                                    setEditingDriver(null);
                                    setDriverForm({ name: '', email: '', password: '', phone: '', license: '', licenseExpiry: '', address: '', vehicleId: '' });
                                    setShowDriverModal(true);
                                }}>
                                    <Plus size={16} /> Add Driver
                                </button>
                            </div>

                            {/* Filter Bar */}
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Filter Availability State:</span>
                                    <select 
                                        value={driverFilter} 
                                        onChange={e => setDriverFilter(e.target.value)}
                                        style={{ width: '190px', padding: '4px 8px', fontSize: '0.8rem', marginBottom: 0 }}
                                    >
                                        <option value="All">All Drivers</option>
                                        <option value="Two-Wheeler">🛵 Two-Wheeler Drivers</option>
                                        <option value="4-Wheeler">🚚 4-Wheeler Drivers</option>
                                        <option value="Available">Available</option>
                                        <option value="Delivering">Delivering</option>
                                        <option value="Offline">Offline</option>
                                        <option value="Suspended">Suspended / SOS (Distress)</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                                {getEnrichedDrivers().filter(drv => {
                                    if (driverFilter === 'All') return true;
                                    if (driverFilter === 'Two-Wheeler') return drv.driverClass === 'Two-Wheeler Driver' || vehicles.find(v => v.id === drv.vehicleId)?.category === 'Two-Wheeler';
                                    if (driverFilter === '4-Wheeler') return drv.driverClass !== 'Two-Wheeler Driver' && vehicles.find(v => v.id === drv.vehicleId)?.category !== 'Two-Wheeler';
                                    if (driverFilter === 'Delivering') return drv.status === 'Busy' || drv.status === 'Delivering';
                                    return drv.status === driverFilter;
                                }).map(drv => {
                                    const assignedVeh = vehicles.find(v => v.id === drv.vehicleId);
                                    const assignedVehName = assignedVeh ? `${assignedVeh.model} (${assignedVeh.vehicleNo})` : 'Unassigned';
                                    const isTwoWheelerDriver = drv.driverClass === 'Two-Wheeler Driver' || assignedVeh?.category === 'Two-Wheeler' || (assignedVeh && assignedVeh.capacity <= 200);
                                    const activeTrip = trips.find(t => t.driverId === drv.id && (t.status === 'Active' || t.status === 'Assigned'));

                                    return (
                                        <div key={drv.id} className="glass-panel" style={{ padding: '1.25rem', position: 'relative', border: drv.status === 'Suspended' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--panel-border)' }}>
                                            {/* Status Badge indicator */}
                                            <span style={{
                                                position: 'absolute',
                                                top: '12px',
                                                right: '12px',
                                                padding: '3px 8px',
                                                borderRadius: '9999px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                backgroundColor: drv.status === 'Online' || drv.status === 'Available' ? 'rgba(16,185,129,0.15)' : (drv.status === 'Busy' || drv.status === 'Delivering' || drv.status === 'Assigned' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)'),
                                                color: drv.status === 'Online' || drv.status === 'Available' ? '#10b981' : (drv.status === 'Busy' || drv.status === 'Delivering' || drv.status === 'Assigned' ? '#3b82f6' : '#ef4444'),
                                                border: '1px solid var(--panel-border)'
                                            }}>
                                                {drv.status}
                                            </span>

                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                <div style={{
                                                    width: '48px',
                                                    height: '48px',
                                                    borderRadius: '50%',
                                                    background: isTwoWheelerDriver ? 'rgba(16, 185, 129, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                                                    border: isTwoWheelerDriver ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(6, 182, 212, 0.2)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <User size={24} style={{ color: isTwoWheelerDriver ? '#10b981' : '#06b6d4' }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{drv.name}</div>
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                                                        <span style={{
                                                            fontSize: '0.7rem',
                                                            fontWeight: 600,
                                                            background: isTwoWheelerDriver ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
                                                            color: isTwoWheelerDriver ? '#10b981' : '#3b82f6',
                                                            padding: '1px 6px',
                                                            borderRadius: '4px',
                                                            border: '1px solid var(--panel-border)'
                                                        }}>
                                                            {isTwoWheelerDriver ? '🛵 Two-Wheeler Driver' : '🚚 4-Wheeler Driver'}
                                                        </span>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lic: {drv.license}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Assigned Vehicle Highlight Banner */}
                                            <div style={{ marginTop: '0.75rem', padding: '6px 10px', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '6px', fontSize: '0.8rem', color: '#0284c7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Truck size={14} /> Assigned Vehicle: <span style={{ color: '#0f172a', fontWeight: 700 }}>{assignedVehName}</span>
                                            </div>

                                            {/* Device statistics block mimicking live smartphone */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '0.75rem 0', padding: '0.5rem', background: 'var(--panel-bg)', borderRadius: '6px', fontSize: '0.8rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Battery size={12} style={{ color: '#10b981' }} /> Battery: <b>{drv.batteryLevel}%</b>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Signal size={12} style={{ color: '#06b6d4' }} /> Net: <b>{drv.networkStatus}</b>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Zap size={12} style={{ color: '#f59e0b' }} /> Speed: <b>{drv.currentSpeed} km/h</b>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Truck size={12} style={{ color: '#3b82f6' }} /> Plate: <b>{assignedVeh?.vehicleNo || 'None'}</b>
                                                </div>
                                            </div>

                                            {/* Score metrics */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}>
                                                <div>Trips: <b>{drv.completedTrips}</b></div>
                                                <div>Score: <b style={{ color: '#10b981' }}>{drv.score}%</b></div>
                                                <div>GPS: <b style={{ color: '#06b6d4' }}>{drv.gps?.lat?.toFixed(3)}, {drv.gps?.lng?.toFixed(3)}</b></div>
                                            </div>

                                            {/* Actions Deck */}
                                            <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--panel-border)', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
                                                <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.75rem', flex: '1' }} title="View Profile" onClick={() => {
                                                    setSelectedProfileDriver(drv);
                                                    setShowDriverProfileModal(true);
                                                }}>
                                                    <Eye size={12} /> Profile
                                                </button>
                                                <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.75rem' }} title="Edit Driver" onClick={() => {
                                                    setEditingDriver(drv);
                                                    setDriverForm({
                                                        name: drv.name,
                                                        email: drv.email || '',
                                                        password: '',
                                                        phone: drv.phone,
                                                        license: drv.license,
                                                        licenseExpiry: drv.licenseExpiry || '',
                                                        address: drv.address || '',
                                                        vehicleId: drv.vehicleId || ''
                                                    });
                                                    setShowDriverModal(true);
                                                }}>
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ padding: '3px 8px', fontSize: '0.75rem', color: drv.status === 'Suspended' ? '#10b981' : '#f59e0b', borderColor: drv.status === 'Suspended' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)' }}
                                                    onClick={() => handleToggleSuspendDriver(drv)}
                                                    disabled={!!activeTrip}
                                                    title={drv.status === 'Suspended' ? 'Activate Driver' : 'Suspend Driver'}
                                                >
                                                    {drv.status === 'Suspended' ? 'Activate' : 'Suspend'}
                                                </button>
                                                
                                                <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => handleDeleteDriver(drv.id)}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>

                                            {/* Vehicle Assignment selectors */}
                                            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.75rem' }}>
                                                <span style={{ color: 'var(--text-muted)' }}>Assign Veh:</span>
                                                <select
                                                    style={{ flex: 1, padding: '3px', background: 'var(--bg-secondary)', border: '1px solid var(--panel-border)', borderRadius: '4px', color: 'var(--text-main)', fontSize: '0.75rem' }}
                                                    value={drv.vehicleId || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val) {
                                                            handleAssignDriverVehicle(drv.id, val);
                                                        } else {
                                                            handleUnassignDriverVehicle(drv.id);
                                                        }
                                                    }}
                                                    disabled={!!activeTrip}
                                                >
                                                    <option value="">Unassigned</option>
                                                    {vehicles.map(v => (
                                                        <option key={v.id} value={v.id}>{v.vehicleNo} ({v.model})</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Contact Button */}
                                            {drv.status !== 'Offline' && (
                                                <div style={{ marginTop: '8px' }}>
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ width: '100%', fontSize: '0.7rem', padding: '3px 6px' }}
                                                        onClick={() => {
                                                            setContactDriverId(drv.id);
                                                            setContactForm({ message: '', type: 'message' });
                                                            setShowContactModal(true);
                                                        }}
                                                    >
                                                        💬 Broadcast Message / Emergency Alert
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ================== TAB: VEHICLES ================== */}
                    {activeTab === 'vehicles' && (
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                                <h4 style={{ margin: 0 }}>Vehicle Asset Fleet</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Filter Operating State:</span>
                                    <select 
                                        value={vehicleFilter} 
                                        onChange={e => setVehicleFilter(e.target.value)}
                                        style={{ width: '185px', padding: '4px 8px', fontSize: '0.8rem', marginBottom: 0 }}
                                    >
                                        <option value="All">All Vehicles</option>
                                        <option value="Two-Wheeler">🛵 Two-Wheelers (Short Load)</option>
                                        <option value="4-Wheeler">🚚 4-Wheelers (Heavy Load)</option>
                                        <option value="Available">Available</option>
                                        <option value="Busy">Busy (Delivering)</option>
                                        <option value="Breakdown">Breakdown</option>
                                        <option value="Maintenance">Maintenance</option>
                                        <option value="Disabled">Disabled</option>
                                        <option value="Offline">Offline</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--panel-border)', color: 'var(--text-muted)' }}>
                                            <th style={{ padding: '10px' }}>License Plate</th>
                                            <th style={{ padding: '10px' }}>Vehicle Class</th>
                                            <th style={{ padding: '10px' }}>Model</th>
                                            <th style={{ padding: '10px' }}>Assigned Driver</th>
                                            <th style={{ padding: '10px' }}>Payload Capacity</th>
                                            <th style={{ padding: '10px' }}>Fuel / Battery</th>
                                            <th style={{ padding: '10px' }}>Maintenance Status</th>
                                            <th style={{ padding: '10px' }}>Operating State</th>
                                            <th style={{ padding: '10px' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {vehicles.filter(v => {
                                            if (vehicleFilter === 'All') return true;
                                            if (vehicleFilter === 'Two-Wheeler') return v.category === 'Two-Wheeler' || v.capacity <= 200 || v.model.toLowerCase().includes('2-wheeler');
                                            if (vehicleFilter === '4-Wheeler') return (v.category !== 'Two-Wheeler' && v.capacity > 200) || v.model.toLowerCase().includes('cargo') || v.model.toLowerCase().includes('truck');
                                            if (vehicleFilter === 'Busy') return v.status === 'Busy' || v.status === 'Delivering';
                                            return v.status === vehicleFilter;
                                        }).map(v => {
                                            const isTwoWheeler = v.category === 'Two-Wheeler' || v.capacity <= 200 || v.model.toLowerCase().includes('2-wheeler');
                                            const assignedDriver = drivers.find(d => d.vehicleId === v.id || d.id === v.driverId);
                                            return (
                                                <tr key={v.id} style={{ borderBottom: '1px solid var(--panel-border)' }}>
                                                    <td style={{ padding: '12px 10px', color: '#06b6d4', fontWeight: 600 }}>{v.vehicleNo}</td>
                                                    <td style={{ padding: '12px 10px' }}>
                                                        {isTwoWheeler ? (
                                                            <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                🛵 Two-Wheeler EV (Short Load)
                                                            </span>
                                                        ) : (
                                                            <span style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                🚚 4-Wheeler Heavy EV
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 10px' }}>{v.model}</td>
                                                    <td style={{ padding: '12px 10px', fontWeight: 600 }}>
                                                        {assignedDriver ? (
                                                            <span style={{ color: '#06b6d4', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                <User size={13} /> {assignedDriver.name}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Unassigned</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '12px 10px' }}>
                                                        {v.capacity} kg {isTwoWheeler ? <span style={{ fontSize: '0.7rem', color: '#10b981' }}>(Small Roads)</span> : ''}
                                                    </td>
                                                    <td style={{ padding: '12px 10px' }}>
                                                        <span style={{ color: v.fuel < 30 ? '#ef4444' : '#10b981' }}>{v.fuel}%</span>
                                                    </td>
                                                    <td style={{ padding: '12px 10px' }}>
                                                        <span style={{
                                                            color: v.maintenanceStatus === 'Broken' ? '#ef4444' : '#10b981',
                                                            fontWeight: 600
                                                        }}>{v.maintenanceStatus}</span>
                                                    </td>
                                                    <td style={{ padding: '12px 10px' }}>
                                                        <span style={{ color: v.status === 'Available' ? '#10b981' : (v.status === 'Busy' ? '#3b82f6' : '#ef4444') }}>
                                                            {v.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px 10px' }}>
                                                        {v.status !== 'Available' && (
                                                            <button
                                                                className="btn btn-secondary"
                                                                style={{ padding: '3px 8px', fontSize: '0.7rem', borderColor: '#10b981', color: '#10b981' }}
                                                                onClick={() => handleRestoreVehicleById(v.id)}
                                                            >
                                                                Bring Back to Live
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ================== TAB: WAREHOUSES ================== */}
                    {activeTab === 'warehouses' && (
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                <h4 style={{ margin: 0 }}>Warehouse Depot Assets</h4>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Filter Asset:</span>
                                        <select 
                                            value={warehouseFilter} 
                                            onChange={e => setWarehouseFilter(e.target.value)}
                                            style={{ width: '155px', padding: '4px 8px', fontSize: '0.8rem', marginBottom: 0 }}
                                        >
                                            <option value="All">All Depots</option>
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                            <option value="High Load">High Load (≥3 orders)</option>
                                            <option value="Low Load">Low Load (&lt;3 orders)</option>
                                            <option value="No Vehicles">No Vehicles Depot</option>
                                        </select>
                                    </div>
                                    <button className="btn btn-primary" onClick={() => {
                                        setEditingWarehouse(null);
                                        setWarehouseForm({ name: '', manager: '', address: '', latitude: '', longitude: '', capacity: '' });
                                        setShowWarehouseModal(true);
                                    }}>
                                        <Plus size={16} /> Add Depot
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                                {warehouses.filter(w => {
                                    if (warehouseFilter === 'All') return true;
                                    const activeOrders = orders.filter(o => o.warehouseId === w.id && o.status !== 'Completed');
                                    const depotVehicles = vehicles.filter(v => v.warehouseId === w.id);
                                    if (warehouseFilter === 'Active') return w.status === 'Active';
                                    if (warehouseFilter === 'Inactive') return w.status === 'Inactive';
                                    if (warehouseFilter === 'High Load') return activeOrders.length >= 3;
                                    if (warehouseFilter === 'Low Load') return activeOrders.length < 3;
                                    if (warehouseFilter === 'No Vehicles') return depotVehicles.length === 0;
                                    return true;
                                }).map(w => {
                                    const activeOrders = orders.filter(o => o.warehouseId === w.id && o.status !== 'Completed');
                                    const depotVehicles = vehicles.filter(v => v.warehouseId === w.id);
                                    const availableVehicles = depotVehicles.filter(v => v.status === 'Available');
                                    const assignedDrivers = drivers.filter(d => depotVehicles.some(v => v.id === d.vehicleId));
                                    const availableDrivers = assignedDrivers.filter(d => d.status === 'Available' || d.status === 'Online');

                                    return (
                                        <div key={w.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <Building size={20} style={{ color: '#06b6d4' }} />
                                                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{w.name}</div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px' }}>
                                                    <button className="btn btn-secondary" style={{ padding: '3px 6px' }} title="Edit Depot" onClick={() => {
                                                        setEditingWarehouse(w);
                                                        setWarehouseForm({
                                                            name: w.name,
                                                            manager: w.manager,
                                                            address: w.address,
                                                            latitude: w.latitude,
                                                            longitude: w.longitude,
                                                            capacity: w.capacity
                                                        });
                                                        setShowWarehouseModal(true);
                                                    }}>
                                                        <Edit2 size={12} />
                                                    </button>
                                                    <button className="btn btn-secondary" style={{ padding: '3px 6px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} title="Delete Depot" onClick={() => handleDeleteWarehouse(w.id)}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                Manager: <b style={{ color: 'var(--text-main)' }}>{w.manager}</b><br />
                                                Address: <b>{w.address}</b><br />
                                                Coordinates: <b style={{ color: '#06b6d4' }}>{w.latitude}, {w.longitude}</b>
                                            </div>

                                            <div style={{ fontSize: '0.85rem' }}>
                                                Storage Space Used:
                                                <div style={{ width: '100%', height: '8px', background: 'var(--panel-bg)', borderRadius: '4px', overflow: 'hidden', marginTop: '4px' }}>
                                                    <div style={{ width: `${Math.min(100, (w.currentInventory / w.capacity * 100))}%`, height: '100%', background: '#3b82f6' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '4px', color: 'var(--text-muted)' }}>
                                                    <span>{w.currentInventory} kg</span>
                                                    <span>{w.capacity} kg ({((w.currentInventory / w.capacity) * 100).toFixed(0)}%)</span>
                                                </div>
                                            </div>

                                            {/* Active Orders Section */}
                                            <div style={{ background: 'var(--panel-bg)', padding: '8px', borderRadius: '6px', fontSize: '0.8rem' }}>
                                                <div style={{ fontWeight: 600, marginBottom: '4px', color: '#f59e0b' }}>
                                                    Active Orders ({activeOrders.length})
                                                </div>
                                                {activeOrders.length === 0 ? (
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No active orders.</span>
                                                ) : (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                                        {activeOrders.map(o => (
                                                            <span key={o.id} style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', color: '#f59e0b' }}>
                                                                {o.id}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Fleet Summary Section */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.75rem' }}>
                                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                                                    <div>Vehicles: <b>{depotVehicles.length}</b></div>
                                                    <div style={{ color: '#10b981' }}>Avail: <b>{availableVehicles.length}</b></div>
                                                </div>
                                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                                                    <div>Drivers: <b>{assignedDrivers.length}</b></div>
                                                    <div style={{ color: '#10b981' }}>Avail: <b>{availableDrivers.length}</b></div>
                                                </div>
                                            </div>

                                            {/* Action to show location */}
                                            <button
                                                className="btn btn-secondary"
                                                style={{ width: '100%', fontSize: '0.75rem', marginTop: '4px' }}
                                                onClick={() => {
                                                    setCenterCoord({ lat: w.latitude, lng: w.longitude });
                                                    setActiveTab('map');
                                                }}
                                            >
                                                📍 Focus Location on Map
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ================== TAB: QUANTUM ================== */}
                    {activeTab === 'quantum' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                            {/* Side by side comparison metrics */}
                            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                                <h4>Quantum Optimization Analysis Log</h4>
                                <div style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '1rem' }}>Below are simulated jobs executed via IBM Quantum QAOA solvers returning converged parameter weights:</div>

                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--panel-border)', color: 'var(--text-muted)' }}>
                                                <th style={{ padding: '10px' }}>Job ID</th>
                                                <th style={{ padding: '10px' }}>Qubit Count</th>
                                                <th style={{ padding: '10px' }}>Expected Energy</th>
                                                <th style={{ padding: '10px' }}>Optimal Route Metric</th>
                                                <th style={{ padding: '10px' }}>Distance Saved</th>
                                                <th style={{ padding: '10px' }}>Optimization Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {trips.filter(t => t.jobId).map(t => (
                                                <tr key={t.id} style={{ borderBottom: '1px solid var(--panel-border)' }}>
                                                    <td style={{ padding: '10px', color: '#3b82f6', fontWeight: 600 }}>{t.jobId || 'qjob-2023'}</td>
                                                    <td style={{ padding: '10px' }}>9 Qubits</td>
                                                    <td style={{ padding: '10px' }}>15.8 H_c</td>
                                                    <td style={{ padding: '10px' }}>{t.expectedDistance} km</td>
                                                    <td style={{ padding: '10px', color: '#10b981' }}>+{(t.expectedDistance * 0.15).toFixed(1)} km</td>
                                                    <td style={{ padding: '10px' }}>42 ms</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* ================== TAB: LIVE MAP ================== */}
                    {activeTab === 'map' && (
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: isTablet ? '1fr' : '1fr 380px', 
                            gap: '1rem', 
                            height: isTablet ? 'auto' : 'calc(100vh - 120px)',
                            overflowY: isTablet ? 'auto' : 'visible'
                        }}>

                            {/* Column 1: Map Viewport (Takes up the vast majority) */}
                            <div className="glass-panel" style={{ 
                                overflow: 'hidden', 
                                height: isTablet ? '500px' : '100%', 
                                display: 'flex', 
                                flexDirection: 'column',
                                minHeight: 0
                            }}>
                                
                                <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                                    <InteractiveMap
                                        warehouses={warehouses}
                                        customers={customers}
                                        vehicles={vehicles}
                                        drivers={drivers}
                                        trips={trips}
                                        routes={currentRouteData}
                                        activeStrategy="both" // Comparison overlay
                                        trafficEvents={events.traffic}
                                        mapMode={mapMode}
                                        onMapModeChange={setMapMode}
                                        focusLabel={selectedOrderForRoute ? selectedOrderForRoute.id : ''}
                                        visibleOverlays={visibleOverlays}
                                        centerOn={centerCoord}
                                        onTripSelect={(tripId) => {
                                            const trip = trips.find(t => t.id === tripId);
                                            if (trip) {
                                                setFocusedTrip(trip);
                                                const drv = drivers.find(d => d.id === trip.driverId);
                                                if (drv && drv.gps) {
                                                    setCenterCoord({ lat: drv.gps.lat, lng: drv.gps.lng });
                                                }
                                                if (trip.orderIds && trip.orderIds.length > 0) {
                                                    const firstOrder = orders.find(x => x.id === trip.orderIds[0]);
                                                    if (firstOrder) {
                                                        setSelectedOrderForRoute(firstOrder);
                                                        fetch(`http://localhost:5000/api/quantum/compare?warehouseId=${trip.warehouseId}&vehicleId=${trip.vehicleId}`)
                                                            .then(res => { if (res.ok) return res.json(); })
                                                            .then(data => { if (data) setCurrentRouteData(data); })
                                                            .catch(err => console.error(err));
                                                    }
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Column 2: Spacious Live Tracking Sidebar (Text & Controls) */}
                            <div className="glass-panel" style={{ 
                                padding: '1.25rem', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '1rem', 
                                height: isTablet ? 'auto' : '100%', 
                                overflowY: 'auto' 
                            }}>
                                <div>
                                    <h4 style={{ margin: 0, color: 'var(--text-main)' }}>Tracking Back-Office</h4>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Configure map layers and monitor dispatches.</span>
                                </div>

                                {/* Search Panel with Filters */}
                                <div className="glass-panel" style={{ padding: '12px', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontWeight: 700, color: '#06b6d4', fontSize: '0.8rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '6px' }}>
                                        🔍 Live Asset Search & Focus
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <select
                                            value={searchType}
                                            onChange={(e) => setSearchType(e.target.value)}
                                            style={{ padding: '4px 6px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff', width: '95px', marginBottom: 0 }}
                                        >
                                            <option value="All">All Types</option>
                                            <option value="Vehicles">Vehicles</option>
                                            <option value="Drivers">Drivers</option>
                                            <option value="Warehouses">Depots</option>
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="Search name, ID, plate..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff', marginBottom: 0 }}
                                        />
                                    </div>

                                    {/* Live results dropdown list */}
                                    {searchQuery.trim().length > 0 && (
                                        <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                                            {(() => {
                                                const query = searchQuery.toLowerCase();
                                                const results = [];

                                                if (searchType === 'All' || searchType === 'Vehicles') {
                                                    vehicles.forEach(v => {
                                                        if (v.vehicleNo.toLowerCase().includes(query) || v.model.toLowerCase().includes(query) || v.id.toLowerCase().includes(query)) {
                                                            results.push({ type: 'vehicle', label: `🚚 ${v.vehicleNo} (${v.model})`, details: v });
                                                        }
                                                    });
                                                }
                                                if (searchType === 'All' || searchType === 'Drivers') {
                                                    drivers.forEach(d => {
                                                        if (d.name.toLowerCase().includes(query) || d.id.toLowerCase().includes(query) || (d.phone && d.phone.includes(query))) {
                                                            results.push({ type: 'driver', label: `👤 ${d.name} (${d.status})`, details: d });
                                                        }
                                                    });
                                                }
                                                if (searchType === 'All' || searchType === 'Warehouses') {
                                                    warehouses.forEach(w => {
                                                        if (w.name.toLowerCase().includes(query) || w.id.toLowerCase().includes(query) || w.manager.toLowerCase().includes(query)) {
                                                            results.push({ type: 'warehouse', label: `🏭 ${w.name}`, details: w });
                                                        }
                                                    });
                                                }

                                                if (results.length === 0) {
                                                    return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '4px' }}>No assets matched.</span>;
                                                }

                                                return results.map((res, i) => (
                                                    <div
                                                        key={i}
                                                        style={{ padding: '6px 8px', fontSize: '0.75rem', color: '#fff', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                        onClick={() => {
                                                            setSelectedSearchItem({ type: res.type, data: res.details });
                                                            if (res.type === 'vehicle') {
                                                                if (res.details.latitude && res.details.longitude) {
                                                                    setCenterCoord({ lat: res.details.latitude, lng: res.details.longitude });
                                                                }
                                                                const associatedTrip = trips.find(t => t.vehicleId === res.details.id && (t.status === 'Active' || t.status === 'Assigned'));
                                                                if (associatedTrip) setFocusedTrip(associatedTrip);
                                                                else setFocusedTrip(null);
                                                            } else if (res.type === 'driver') {
                                                                if (res.details.gps) {
                                                                    setCenterCoord({ lat: res.details.gps.lat, lng: res.details.gps.lng });
                                                                }
                                                                const associatedTrip = trips.find(t => t.driverId === res.details.id && (t.status === 'Active' || t.status === 'Assigned'));
                                                                if (associatedTrip) setFocusedTrip(associatedTrip);
                                                                else setFocusedTrip(null);
                                                            } else if (res.type === 'warehouse') {
                                                                if (res.details.latitude && res.details.longitude) {
                                                                    setCenterCoord({ lat: res.details.latitude, lng: res.details.longitude });
                                                                }
                                                                setFocusedTrip(null);
                                                            }
                                                        }}
                                                    >
                                                        <span>{res.label}</span>
                                                        <span style={{ fontSize: '0.65rem', color: '#06b6d4', fontWeight: 'bold' }}>Focus 🎯</span>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {/* Checklist: Map Overlays Configuration */}
                                <div className="glass-panel" style={{ padding: '12px', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                                    <div style={{ fontWeight: 700, color: '#06b6d4', fontSize: '0.8rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '6px', marginBottom: '8px' }}>
                                        Map Overlays Visibility
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        {[
                                            { id: 'traffic', name: '⚠️ Traffic Blocks' },
                                            { id: 'warehouses', name: '🏭 Depots' },
                                            { id: 'drivers', name: '👤 Drivers' },
                                            { id: 'vehicles', name: '🚚 Vehicles' },
                                            { id: 'customers', name: '📍 Customers' },
                                            { id: 'quantumRoute', name: '🔵 Quantum Route' },
                                            { id: 'actualRoadRoute', name: '🟢 Road Route' }
                                        ].map(layer => (
                                            <label key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-main)', userSelect: 'none' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={visibleOverlays[layer.id]}
                                                    onChange={() => setVisibleOverlays({ ...visibleOverlays, [layer.id]: !visibleOverlays[layer.id] })}
                                                    style={{ width: 'auto', marginBottom: 0, cursor: 'pointer' }}
                                                />
                                                <span>{layer.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Dropdown Selector for Active Dispatches */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <label style={{ fontWeight: 700, color: '#3b82f6', fontSize: '0.8rem' }}>Active Dispatch Roster ({trips.filter(t => t.status === 'Active' || t.status === 'Assigned').length})</label>
                                    <select
                                        value={focusedTrip?.id || ''}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const trip = trips.find(t => t.id === val);
                                            if (trip) {
                                                setFocusedTrip(trip);
                                                const drv = drivers.find(d => d.id === trip.driverId);
                                                if (drv && drv.gps) {
                                                    setCenterCoord({ lat: drv.gps.lat, lng: drv.gps.lng });
                                                }
                                                if (trip.orderIds && trip.orderIds.length > 0) {
                                                    const firstOrder = orders.find(x => x.id === trip.orderIds[0]);
                                                    if (firstOrder) {
                                                        setSelectedOrderForRoute(firstOrder);
                                                        fetch(`http://localhost:5000/api/quantum/compare?warehouseId=${trip.warehouseId}&vehicleId=${trip.vehicleId}`)
                                                            .then(res => { if (res.ok) return res.json(); })
                                                            .then(data => { if (data) setCurrentRouteData(data); })
                                                            .catch(err => console.error(err));
                                                    }
                                                }
                                            } else {
                                                setFocusedTrip(null);
                                                setSelectedOrderForRoute(null);
                                                setCurrentRouteData(null);
                                            }
                                        }}
                                        style={{ width: '100%', padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}
                                    >
                                        <option value="">-- Select Active Dispatch to Track --</option>
                                        {trips.filter(t => t.status === 'Active' || t.status === 'Assigned').map(t => {
                                            const drv = drivers.find(d => d.id === t.driverId);
                                            return (
                                                <option key={t.id} value={t.id}>
                                                    {t.id} - {drv ? drv.name : 'Unknown'} ({t.status === 'Active' ? 'Delivering' : 'Assigned'})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                {/* Active Tracking details */}
                                {focusedTrip ? (
                                    (() => {
                                        const drv = drivers.find(d => d.id === focusedTrip.driverId);
                                        const veh = vehicles.find(v => v.id === focusedTrip.vehicleId);
                                        const wh = warehouses.find(w => w.id === focusedTrip.warehouseId);

                                        const currentStep = focusedTrip.currentRoadRouteIndex || 0;
                                        const totalSteps = focusedTrip.roadRoute ? focusedTrip.roadRoute.length : 10;
                                        const remDist = Math.max(0, focusedTrip.expectedDistance * (1 - (currentStep / Math.max(1, totalSteps))));
                                        const remTime = Math.ceil(focusedTrip.expectedTime * (1 - (currentStep / Math.max(1, totalSteps))));

                                        const stepCreated = true;
                                        const stepDepot = !!focusedTrip.warehouseId;
                                        const stepOpt = !!focusedTrip.jobId;
                                        const stepAssigned = true;
                                        const stepAccepted = focusedTrip.status === 'Active' || focusedTrip.status === 'Completed';
                                        const stepPickedUp = focusedTrip.status === 'Active' || focusedTrip.status === 'Completed';
                                        const stepOnRoute = focusedTrip.status === 'Active' && currentStep > 0;
                                        const stepNear = focusedTrip.status === 'Active' && focusedTrip.roadRoute && currentStep >= totalSteps - 3;
                                        const stepDelivered = focusedTrip.status === 'Completed';

                                        return (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {/* Live Delivery Card */}
                                                <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid #06b6d4', borderRadius: '6px' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#06b6d4', marginBottom: '6px' }}>
                                                        LIVE DELIVERY CARD
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                                                        <div>Order IDs: <b>{focusedTrip.orderIds?.join(', ')}</b></div>
                                                        <div>Driver Name: <b>{drv?.name || 'Unknown'}</b></div>
                                                        <div>Vehicle Plate: <b>{veh?.vehicleNo || 'Unassigned'}</b></div>
                                                        <div>Depot Source: <b>{wh?.name || 'Unknown'}</b></div>
                                                        <div>Status: <b style={{ color: focusedTrip.isPaused ? '#ef4444' : '#10b981' }}>{focusedTrip.isPaused ? 'Paused' : focusedTrip.status}</b></div>
                                                        {focusedTrip.status === 'Completed' ? (
                                                            <div>Actual travel time: <b style={{ color: '#10b981' }}>{focusedTrip.actualTimeTakenMinutes || focusedTrip.expectedTime} mins</b></div>
                                                        ) : (
                                                            <div>ETA remaining: <b style={{ color: '#f59e0b' }}>{remTime} mins</b></div>
                                                        )}
                                                        <div>Distance left: <b>{remDist.toFixed(2)} km</b></div>
                                                        <div>Current Speed: <b>{drv?.currentSpeed || 0} km/h</b></div>
                                                        <div>Telemetry Battery: <b>{drv?.batteryLevel}%</b></div>
                                                        <div>Signal: <b style={{ color: '#06b6d4' }}>{drv?.networkStatus || 'Online'}</b></div>
                                                    </div>
                                                </div>

                                                {/* Stepper Timeline */}
                                                <div className="glass-panel" style={{ padding: '12px', background: 'rgba(0,0,0,0.1)', borderRadius: '6px' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#3b82f6', marginBottom: '8px' }}>
                                                        Live Order Timeline
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingLeft: '8px', borderLeft: '2px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                                                        {[
                                                            { label: 'Created', done: stepCreated },
                                                            { label: 'Warehouse Depot Selected', done: stepDepot },
                                                            { label: 'Quantum Optimizer Run', done: stepOpt },
                                                            { label: 'Driver/Vehicle Assigned', done: stepAssigned },
                                                            { label: 'Driver Accepted Assignment', done: stepAccepted },
                                                            { label: 'Package Picked Up from Depot', done: stepPickedUp },
                                                            { label: 'On Route (Telemetry Active)', done: stepOnRoute },
                                                            { label: 'Near Customer Destination', done: stepNear },
                                                            { label: 'Package Delivered', done: stepDelivered }
                                                        ].map((step, idx) => (
                                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem', position: 'relative' }}>
                                                                <span style={{
                                                                    width: '12px',
                                                                    height: '12px',
                                                                    borderRadius: '50%',
                                                                    background: step.done ? '#10b981' : 'rgba(255,255,255,0.1)',
                                                                    border: step.done ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.2)',
                                                                    display: 'inline-block',
                                                                    boxShadow: step.done ? '0 0 6px #10b981' : 'none',
                                                                    marginLeft: '-15px'
                                                                }} />
                                                                <span style={{ color: step.done ? '#fff' : '#9ca3af', fontWeight: step.done ? 600 : 400 }}>
                                                                    {step.label}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Admin Actions Override Panel */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>
                                                        Administrative Overrides
                                                    </div>
                                                    
                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ borderColor: focusedTrip.isPaused ? '#10b981' : '#f59e0b', color: focusedTrip.isPaused ? '#10b981' : '#f59e0b', fontSize: '0.8rem' }}
                                                        onClick={() => handleTogglePauseTrip(focusedTrip)}
                                                    >
                                                        {focusedTrip.isPaused ? '▶️ Resume Delivery' : '⏸️ Pause Delivery'}
                                                    </button>

                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ borderColor: '#ef4444', color: '#ef4444', fontSize: '0.8rem' }}
                                                        onClick={() => handleCancelTrip(focusedTrip.id)}
                                                    >
                                                        🚫 Cancel Delivery
                                                    </button>

                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ fontSize: '0.8rem' }}
                                                        disabled={focusedTrip.status !== 'Assigned'}
                                                        onClick={() => {
                                                            setTripToReassign(focusedTrip);
                                                            setReassignForm({ driverId: focusedTrip.driverId, vehicleId: focusedTrip.vehicleId });
                                                            setShowReassignModal(true);
                                                        }}
                                                    >
                                                        🔄 Reassign Driver/Vehicle
                                                    </button>

                                                    <button
                                                        className="btn btn-secondary btn-danger"
                                                        style={{ fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                                        onClick={() => {
                                                            setContactDriverId(focusedTrip.driverId);
                                                            setContactForm({ message: '', type: 'emergency' });
                                                            setShowContactModal(true);
                                                        }}
                                                    >
                                                        🚨 Send Emergency Alert
                                                    </button>

                                                    <button
                                                        className="btn btn-secondary"
                                                        style={{ fontSize: '0.8rem' }}
                                                        onClick={() => {
                                                            setContactDriverId(focusedTrip.driverId);
                                                            setContactForm({ message: '', type: 'message' });
                                                            setShowContactModal(true);
                                                        }}
                                                    >
                                                        💬 Contact Driver
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })()
                                ) : selectedSearchItem ? (
                                    (() => {
                                        const type = selectedSearchItem.type;
                                        const item = selectedSearchItem.data;

                                        if (type === 'vehicle') {
                                            const drv = drivers.find(d => d.vehicleId === item.id);
                                            const wh = warehouses.find(w => w.id === item.warehouseId);
                                            return (
                                                <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid #06b6d4', borderRadius: '6px' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#06b6d4', marginBottom: '6px' }}>
                                                        VEHICLE DETAILS
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                                                        <div>Plate Number: <b>{item.vehicleNo}</b></div>
                                                        <div>Model: <b>{item.model}</b></div>
                                                        <div>Payload Capacity: <b>{item.capacity} kg</b></div>
                                                        <div>Fuel / Battery: <b style={{ color: item.fuel < 30 ? '#ef4444' : '#10b981' }}>{item.fuel}%</b></div>
                                                        <div>Maintenance: <b>{item.maintenanceStatus}</b></div>
                                                        <div>Depot Source: <b>{wh?.name || 'Unassigned'}</b></div>
                                                        <div>Assigned Driver: <b>{drv?.name || 'Unassigned'}</b></div>
                                                        <div>State: <b style={{ color: item.status === 'Available' ? '#10b981' : '#3b82f6' }}>{item.status}</b></div>
                                                    </div>
                                                </div>
                                            );
                                        } else if (type === 'driver') {
                                            const veh = vehicles.find(v => v.id === item.vehicleId);
                                            return (
                                                <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid #06b6d4', borderRadius: '6px' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#06b6d4', marginBottom: '6px' }}>
                                                        DRIVER DETAILS
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                                                        <div>Name: <b>{item.name}</b></div>
                                                        <div>Email: <b>{item.email}</b></div>
                                                        <div>Phone: <b>{item.phone}</b></div>
                                                        <div>License: <b>{item.license}</b></div>
                                                        <div>License Expiry: <b>{item.licenseExpiry}</b></div>
                                                        <div>Assigned Vehicle: <b>{veh?.vehicleNo || 'None'}</b></div>
                                                        <div>Device Battery: <b>{item.batteryLevel}%</b></div>
                                                        <div>Signal: <b>{item.networkStatus}</b></div>
                                                        <div>Driver Score: <b>{item.score}%</b></div>
                                                        <div>Status: <b style={{ color: item.status === 'Available' ? '#10b981' : '#3b82f6' }}>{item.status}</b></div>
                                                    </div>
                                                </div>
                                            );
                                        } else if (type === 'warehouse') {
                                            const depotVehicles = vehicles.filter(v => v.warehouseId === item.id);
                                            return (
                                                <div className="glass-panel" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid #06b6d4', borderRadius: '6px' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#06b6d4', marginBottom: '6px' }}>
                                                        DEPOT DETAILS
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
                                                        <div>Name: <b>{item.name}</b></div>
                                                        <div>Manager: <b>{item.manager}</b></div>
                                                        <div>Address: <b>{item.address}</b></div>
                                                        <div>Capacity: <b>{item.capacity} kg</b></div>
                                                        <div>Inventory: <b>{item.currentInventory} kg</b></div>
                                                        <div>Active Vehicles: <b>{depotVehicles.length}</b></div>
                                                        <div>Coordinates: <b>{item.latitude}, {item.longitude}</b></div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()
                                ) : (
                                    <div style={{ color: '#9ca3af', fontSize: '0.85rem', textAlign: 'center', marginTop: '1rem', padding: '1.25rem', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                                        Select a dispatch or search for an asset to start live tracking and view telemetry details.
                                    </div>
                                )}
                            </div>

                        </div>
                    )}

                    {/* ================== TAB: NOTIFICATIONS ================== */}
                    {activeTab === 'notifications' && (
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                                <h4 style={{ margin: 0 }}>System Logs & Broadcast Feed</h4>
                                <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={handleClearNotifications}>
                                    Mark All Read
                                </button>
                            </div>

                            {/* Dropdown Filters */}
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Filter Type:</span>
                                    <select 
                                        value={notifFilterType} 
                                        onChange={e => setNotifFilterType(e.target.value)}
                                        style={{ width: '140px', padding: '4px 8px', fontSize: '0.8rem', marginBottom: 0 }}
                                    >
                                        <option value="All">All Types</option>
                                        <option value="System">System Logs</option>
                                        <option value="Trip">Trip Dispatches</option>
                                        <option value="Order">Orders</option>
                                        <option value="Alert">Alert Warnings</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Filter Status:</span>
                                    <select 
                                        value={notifFilterRead} 
                                        onChange={e => setNotifFilterRead(e.target.value)}
                                        style={{ width: '120px', padding: '4px 8px', fontSize: '0.8rem', marginBottom: 0 }}
                                    >
                                        <option value="All">All Read/Unread</option>
                                        <option value="Unread">Unread</option>
                                        <option value="Read">Read</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Sort Order:</span>
                                    <select 
                                        value={notifSortOrder} 
                                        onChange={e => setNotifSortOrder(e.target.value)}
                                        style={{ width: '130px', padding: '4px 8px', fontSize: '0.8rem', marginBottom: 0 }}
                                    >
                                        <option value="desc">Newest First</option>
                                        <option value="asc">Oldest First</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {(() => {
                                    const filtered = notifications.filter(n => {
                                        if (notifFilterType !== 'All' && n.type !== notifFilterType) return false;
                                        if (notifFilterRead === 'Unread' && n.read) return false;
                                        if (notifFilterRead === 'Read' && !n.read) return false;
                                        return true;
                                    });

                                    filtered.sort((a, b) => {
                                        const timeA = new Date(a.timestamp).getTime();
                                        const timeB = new Date(b.timestamp).getTime();
                                        return notifSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
                                    });

                                    return filtered.length === 0 ? (
                                        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>No matching updates.</div>
                                    ) : (
                                        filtered.map(n => (
                                            <div key={n.id} style={{ padding: '1rem', background: n.read ? 'rgba(255,255,255,0.01)' : 'rgba(6, 182, 212, 0.05)', border: n.read ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: n.read ? '#fff' : '#06b6d4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {n.title}
                                                        <span style={{ fontSize: '0.65rem', background: n.type === 'Alert' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', color: n.type === 'Alert' ? '#ef4444' : '#9ca3af', padding: '1px 5px', borderRadius: '4px' }}>
                                                            {n.type || 'System'}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{n.message}</span>
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{new Date(n.timestamp).toLocaleTimeString()}</span>
                                            </div>
                                        ))
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* ================== TAB: REPORTS ================== */}
                    {activeTab === 'reports' && (
                        <div className="glass-panel" style={{ padding: '1.5rem' }}>
                            <h4>Reports Engine</h4>
                            <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Download and export operational statistics (Simulated format):</p>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginTop: '1.5rem' }}>
                                <button className="btn btn-primary" onClick={() => alert("Downloading PDF Operational Report...")}>
                                    Export Dashboard PDF
                                </button>
                                <button className="btn btn-secondary" onClick={() => alert("Exporting XML/CSV sheets...")}>
                                    Export Excel Sheets
                                </button>
                                <button className="btn btn-secondary" onClick={() => alert("Generating csv format...")}>
                                    Export raw CSV details
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ================== TAB: SETTINGS ================== */}
                    {activeTab === 'settings' && (
                        <div className="glass-panel" style={{ padding: '1.5rem', maxWidth: '600px' }}>
                            <h4>System Configuration</h4>
                            <div style={{ marginTop: '1.5rem' }}>
                                <label>Google Maps Javascript API Key</label>
                                <input type="text" placeholder="AIzaSyA1..." readonly value="• MOCK_KEY_LOADED (Chennaie area OSM fallback configured) •" />

                                <label>IBM Quantum Service URL</label>
                                <input type="text" placeholder="https://quantum-computing.ibm.com/api..." value="https://quantum-computing.ibm.com/mock-qiskit-endpoint" readonly />

                                <label>System Mode</label>
                                <input type="text" value="Hybrid Classic-Quantum VRP (QAOA)" readonly />
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* --- ADD ORDER MODAL --- */}
            {showOrderModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel" style={{ position: 'relative' }}>
                        <button style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowOrderModal(false)}>
                            <X size={20} />
                        </button>
                        <h3>Launch Order</h3>
                        <form onSubmit={handleCreateOrder}>
                            <label>Select Customer Destination</label>
                            <select value={newOrder.customerId} onChange={e => setNewOrder({ ...newOrder, customerId: e.target.value })} required>
                                <option value="">Select Destination</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.priority} Priority)</option>)}
                            </select>

                            <label>Warehouse Source Pickup</label>
                            <select value={newOrder.warehouseId} onChange={e => setNewOrder({ ...newOrder, warehouseId: e.target.value })} required>
                                <option value="">Select Depot</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>

                            <label>Order Size (kg)</label>
                            <input type="number" value={newOrder.size} onChange={e => setNewOrder({ ...newOrder, size: parseInt(e.target.value) })} required />

                            <label>Trip Carrier Priority</label>
                            <select value={newOrder.priority} onChange={e => setNewOrder({ ...newOrder, priority: e.target.value })}>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowOrderModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Order</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- WORKFLOW: ASSIGN DRIVER MODAL --- */}
            {showAssignModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel" style={{ position: 'relative' }}>
                        <button style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowAssignModal(false)}>
                            <X size={20} />
                        </button>
                        <h3>Quantum Dispatch Assignation Workflow</h3>
                        <form onSubmit={handleExecuteAssignment}>
                            <label>Depot Source Point</label>
                            <select value={assignForm.warehouseId} onChange={e => setAssignForm({ ...assignForm, warehouseId: e.target.value })} required>
                                <option value="">Select Depot</option>
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>

                            <label>Select Operating Vehicle</label>
                            <select value={assignForm.vehicleId} onChange={e => setAssignForm({ ...assignForm, vehicleId: e.target.value })} required>
                                <option value="">Select Vehicle Asset</option>
                                {vehicles.filter(v => v.status === 'Available' && !trips.some(t => t.vehicleId === v.id && (t.status === 'Active' || t.status === 'Assigned'))).map(v => (
                                    <option key={v.id} value={v.id}>{v.vehicleNo} ({v.model})</option>
                                ))}
                            </select>

                            <label>Assign Driver</label>
                            <select value={assignForm.driverId} onChange={e => setAssignForm({ ...assignForm, driverId: e.target.value })} required>
                                <option value="">Select Driver</option>
                                {drivers.filter(d => (d.status === 'Online' || d.status === 'Available') && !trips.some(t => t.driverId === d.id && (t.status === 'Active' || t.status === 'Assigned'))).map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                                ))}
                            </select>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary btn-quantum">Run Quantum Optimizer & Assign</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- ADD/EDIT DRIVER MODAL --- */}
            {showDriverModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel" style={{ position: 'relative' }}>
                        <button style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowDriverModal(false)}>
                            <X size={20} />
                        </button>
                        <h3>{editingDriver ? 'Edit Driver Profile' : 'Add New Driver'}</h3>
                        <form onSubmit={handleSaveDriver}>
                            <label>Full Name</label>
                            <input type="text" value={driverForm.name} onChange={e => setDriverForm({ ...driverForm, name: e.target.value })} required />

                            <label>Email Address</label>
                            <input type="email" value={driverForm.email} onChange={e => setDriverForm({ ...driverForm, email: e.target.value })} required />

                            {!editingDriver && (
                                <>
                                    <label>Security Password</label>
                                    <input type="password" value={driverForm.password} onChange={e => setDriverForm({ ...driverForm, password: e.target.value })} required />
                                </>
                            )}

                            <label>Phone Number</label>
                            <input type="text" value={driverForm.phone} onChange={e => setDriverForm({ ...driverForm, phone: e.target.value })} required />

                            <label>License Plate Reference</label>
                            <input type="text" value={driverForm.license} onChange={e => setDriverForm({ ...driverForm, license: e.target.value })} required />

                            <label>License Expiry (YYYY-MM-DD)</label>
                            <input type="text" placeholder="2028-12-31" value={driverForm.licenseExpiry} onChange={e => setDriverForm({ ...driverForm, licenseExpiry: e.target.value })} required />

                            <label>Home Address</label>
                            <input type="text" value={driverForm.address} onChange={e => setDriverForm({ ...driverForm, address: e.target.value })} required />

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowDriverModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingDriver ? 'Save Updates' : 'Register Driver'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- ADD/EDIT WAREHOUSE MODAL --- */}
            {showWarehouseModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel" style={{ position: 'relative' }}>
                        <button style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowWarehouseModal(false)}>
                            <X size={20} />
                        </button>
                        <h3>{editingWarehouse ? 'Edit Warehouse Depot' : 'Add Warehouse Depot'}</h3>
                        <form onSubmit={handleSaveWarehouse}>
                            <label>Depot Name</label>
                            <input type="text" value={warehouseForm.name} onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })} required />

                            <label>General Manager</label>
                            <input type="text" value={warehouseForm.manager} onChange={e => setWarehouseForm({ ...warehouseForm, manager: e.target.value })} required />

                            <label>Street Address</label>
                            <input type="text" value={warehouseForm.address} onChange={e => setWarehouseForm({ ...warehouseForm, address: e.target.value })} required />

                            <label>Latitude Coordinate</label>
                            <input type="number" step="any" value={warehouseForm.latitude} onChange={e => setWarehouseForm({ ...warehouseForm, latitude: parseFloat(e.target.value) })} required />

                            <label>Longitude Coordinate</label>
                            <input type="number" step="any" value={warehouseForm.longitude} onChange={e => setWarehouseForm({ ...warehouseForm, longitude: parseFloat(e.target.value) })} required />

                            <label>Storage Weight Capacity (kg)</label>
                            <input type="number" value={warehouseForm.capacity} onChange={e => setWarehouseForm({ ...warehouseForm, capacity: parseInt(e.target.value) })} required />

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowWarehouseModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingWarehouse ? 'Save Updates' : 'Add Depot'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- VIEW DRIVER PROFILE & COMPLETED TRIPS MODAL --- */}
            {showDriverProfileModal && selectedProfileDriver && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel" style={{ position: 'relative', maxWidth: '600px' }}>
                        <button style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowDriverProfileModal(false)}>
                            <X size={20} />
                        </button>
                        <h3>Driver Profile: {selectedProfileDriver.name}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', marginBottom: '15px' }}>
                            <div>Email: <b>{selectedProfileDriver.email || 'N/A'}</b></div>
                            <div>Phone: <b>{selectedProfileDriver.phone}</b></div>
                            <div>License: <b>{selectedProfileDriver.license}</b></div>
                            <div>License Expiry: <b>{selectedProfileDriver.licenseExpiry || 'N/A'}</b></div>
                            <div>Joined Date: <b>{selectedProfileDriver.joinedDate || 'N/A'}</b></div>
                            <div>Home Address: <b>{selectedProfileDriver.address || 'N/A'}</b></div>
                            <div>Status State: <b>{selectedProfileDriver.status}</b></div>
                            <div>Safety Performance Score: <b style={{ color: '#10b981' }}>{selectedProfileDriver.score}%</b></div>
                        </div>

                        <h4>Completed Deliveries History</h4>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
                            {trips.filter(t => t.driverId === selectedProfileDriver.id && t.status === 'Completed').length === 0 ? (
                                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>No completed trips recorded yet.</span>
                            ) : (
                                trips.filter(t => t.driverId === selectedProfileDriver.id && t.status === 'Completed').map(t => (
                                    <div key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px', marginBottom: '6px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                                        <div>
                                            <span style={{ color: '#06b6d4', fontWeight: 600 }}>{t.id}</span> (Orders: {t.orderIds?.join(', ')})
                                        </div>
                                        <div style={{ color: '#9ca3af' }}>
                                            {t.expectedDistance} km (Delivered in: {t.actualTimeTakenMinutes || t.expectedTime} mins)
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowDriverProfileModal(false)}>Close View</button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- REASSIGN TRIP MODAL --- */}
            {showReassignModal && tripToReassign && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel" style={{ position: 'relative' }}>
                        <button style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowReassignModal(false)}>
                            <X size={20} />
                        </button>
                        <h3>Reassign Dispatch: {tripToReassign.id}</h3>
                        <form onSubmit={handleReassignTripSubmit}>
                            <label>Select New Vehicle</label>
                            <select value={reassignForm.vehicleId} onChange={e => setReassignForm({ ...reassignForm, vehicleId: e.target.value })} required>
                                <option value="">Select Available Vehicle</option>
                                {vehicles.filter(v => v.status === 'Available' && !trips.some(t => t.vehicleId === v.id && (t.status === 'Active' || t.status === 'Assigned'))).map(v => (
                                    <option key={v.id} value={v.id}>{v.vehicleNo} ({v.model})</option>
                                ))}
                            </select>

                            <label>Select New Driver</label>
                            <select value={reassignForm.driverId} onChange={e => setReassignForm({ ...reassignForm, driverId: e.target.value })} required>
                                <option value="">Select Available Driver</option>
                                {drivers.filter(d => (d.status === 'Online' || d.status === 'Available') && !trips.some(t => t.driverId === d.id && (t.status === 'Active' || t.status === 'Assigned'))).map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                                ))}
                            </select>

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowReassignModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Reassign & Update Dispatch</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- CONTACT / EMERGENCY ALERT MODAL --- */}
            {showContactModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-panel" style={{ position: 'relative' }}>
                        <button style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }} onClick={() => setShowContactModal(false)}>
                            <X size={20} />
                        </button>
                        <h3>Broadcast Alert / Contact Dispatch</h3>
                        <form onSubmit={handleSendContactMessage}>
                            <label>Broadcast Message Type</label>
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                                    <input type="radio" name="msgType" checked={contactForm.type === 'message'} onChange={() => setContactForm({ ...contactForm, type: 'message' })} style={{ width: 'auto', marginBottom: 0 }} />
                                    <span>Regular Contact SMS</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#ef4444' }}>
                                    <input type="radio" name="msgType" checked={contactForm.type === 'emergency'} onChange={() => setContactForm({ ...contactForm, type: 'emergency' })} style={{ width: 'auto', marginBottom: 0 }} />
                                    <span>🚨 Emergency Broadcast (Push Alert)</span>
                                </label>
                            </div>

                            <label>Alert Notification Text</label>
                            <textarea style={{ width: '100%', height: '80px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', fontSize: '0.85rem' }} value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} placeholder="Type broadcast message or safety alarm text..." required />

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowContactModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ background: contactForm.type === 'emergency' ? '#ef4444' : '#06b6d4', borderColor: contactForm.type === 'emergency' ? '#ef4444' : '#06b6d4' }}>Send Broadcast</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
