import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

export default function InteractiveMap({
    warehouses = [],
    customers = [],
    vehicles = [],
    drivers = [],
    trips = [],
    routes = null,
    activeStrategy = 'quantum',
    trafficEvents = [],
    mapMode = 'roadmap',
    visibleOverlays = {
        warehouses: true,
        vehicles: true,
        drivers: true,
        customers: true,
        traffic: true,
        quantumRoute: true,
        actualRoadRoute: true
    },
    onMapModeChange,
    onOverlayToggle,
    centerOn,
    focusLabel = '',
    onTripSelect,
    selectedTripId = null
}) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const layersRef = useRef({});
    const markersRef = useRef({});
    const polylinesRef = useRef({});
    const animatedPositionsRef = useRef({});
    const animFrameRef = useRef(null);
    
    const [selectedTripInfo, setSelectedTripInfo] = useState(null);

    // SVG Custom Icons matching Mobile App visuals
    const createSvgIcon = (type, name = '', status = '', priority = '', rotation = 0) => {
        let svgHtml = '';

        if (type === 'warehouse') {
            svgHtml = `
                <div style="background: rgba(16, 185, 129, 0.2); border: 2.5px solid #10b981; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(16, 185, 129, 0.6);">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
            `;
        } else if (type === 'customer') {
            const isHigh = priority === 'High';
            const borderClr = isHigh ? '#ef4444' : '#3b82f6';
            const fillClr = isHigh ? '#ef4444' : '#3b82f6';
            svgHtml = `
                <div style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));">
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="${fillClr}" stroke="#ffffff" stroke-width="1.8">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3.5" fill="#ffffff"></circle>
                  </svg>
                </div>
            `;
        } else if (type === 'traveling') {
            // Live Driver Navigation Cursor (Matching Flutter Mobile Navigation Cursor)
            svgHtml = `
                <div style="transform: rotate(${rotation}deg); transition: transform 0.3s ease-out; background: #0f172a; border: 2.5px solid #06b6d4; border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 14px rgba(6,182,212,0.8);">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#06b6d4" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
                  </svg>
                </div>
            `;
        } else if (type === 'vehicle') {
            const isBreakdown = status === 'Under Maintenance' || status === 'Broken';
            const fillClr = isBreakdown ? '#ef4444' : '#06b6d4';
            svgHtml = `
                <div style="background: rgba(15,23,42,0.9); border: 2px solid ${fillClr}; border-radius: 8px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px ${fillClr};">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${fillClr}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1" y="3" width="15" height="13"></rect>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                    <circle cx="5.5" cy="18.5" r="2.5"></circle>
                    <circle cx="18.5" cy="18.5" r="2.5"></circle>
                  </svg>
                </div>
            `;
        } else if (type === 'driver') {
            const isOnline = status === 'Online' || status === 'Available';
            const color = isOnline ? '#10b981' : (status === 'Suspended' ? '#6b7280' : '#ef4444');
            svgHtml = `
                <div style="background: rgba(15,23,42,0.9); border: 2px solid ${color}; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px ${color}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
            `;
        } else if (type === 'traffic') {
            svgHtml = `
                <div style="background: rgba(239, 68, 68, 0.3); border: 2.2px solid #ef4444; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px #ef4444;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </div>
            `;
        }

        return L.divIcon({
            html: svgHtml,
            className: 'custom-quantum-icon',
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });
    };

    // Initialize Map
    useEffect(() => {
        if (!mapRef.current && mapContainerRef.current) {
            const map = L.map(mapContainerRef.current, {
                zoomControl: true,
                attributionControl: false
            }).setView([13.045, 80.25], 12.5);

            // Tile layers matching mobile app tile themes
            const layers = {
                roadmap: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' }),
                satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
                terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'),
                hybrid: L.layerGroup([
                    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
                    L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-hybrid/{z}/{x}/{y}.png', { opacity: 0.8 })
                ])
            };

            layersRef.current = layers;
            layers.roadmap.addTo(map);
            mapRef.current = map;
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Smooth 60 FPS Interpolation Animation Loop
    useEffect(() => {
        const animate = () => {
            const anims = animatedPositionsRef.current;
            Object.keys(anims).forEach(key => {
                const item = anims[key];
                if (!item) return;

                // Smooth LERP (Linear Interpolation)
                const latDiff = item.targetLat - item.currentLat;
                const lngDiff = item.targetLng - item.currentLng;

                if (Math.abs(latDiff) > 0.000001 || Math.abs(lngDiff) > 0.000001) {
                    item.currentLat += latDiff * 0.12;
                    item.currentLng += lngDiff * 0.12;

                    const marker = markersRef.current[key];
                    if (marker) {
                        marker.setLatLng([item.currentLat, item.currentLng]);
                    }
                }
            });

            animFrameRef.current = requestAnimationFrame(animate);
        };

        animFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, []);

    // Center map reactively with smooth panning
    useEffect(() => {
        if (!mapRef.current) return;
        const target = centerOn || {};
        const lat = target.latitude || target.lat;
        const lng = target.longitude || target.lng;
        if (lat && lng) {
            mapRef.current.panTo([lat, lng], { animate: true, duration: 0.8 });
        }
    }, [centerOn]);

    // Sync Map Tile Layer
    useEffect(() => {
        if (!mapRef.current || !layersRef.current) return;
        const map = mapRef.current;

        Object.values(layersRef.current).forEach(layer => {
            if (map.hasLayer(layer)) map.removeLayer(layer);
        });

        const selectedLayer = layersRef.current[mapMode] || layersRef.current.roadmap;
        selectedLayer.addTo(map);

        if (mapMode === 'roadmap' || mapMode === 'terrain') {
            if (mapContainerRef.current) mapContainerRef.current.className = 'dark-map';
        } else {
            if (mapContainerRef.current) mapContainerRef.current.className = '';
        }
    }, [mapMode]);

    // Render Markers, Polylines, and Navigation Progress
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        const newMarkersMap = {};
        const oldMarkersMap = { ...markersRef.current };
        const allItems = [];

        // 1. Warehouses
        if (visibleOverlays.warehouses) {
            warehouses.forEach(wh => {
                allItems.push({
                    type: 'warehouse',
                    lat: wh.latitude,
                    lng: wh.longitude,
                    popupContent: `
                        <div>
                            <b style="color: #10b981; font-size: 0.85rem;">🏭 Hub Depot: ${wh.name}</b>
                            <div style="margin-top: 6px;"><b>Manager:</b> ${wh.manager}</div>
                            <div><b>Capacity:</b> ${wh.capacity} kg</div>
                            <div><b>Inventory:</b> ${wh.currentInventory} kg</div>
                        </div>
                    `,
                    raw: wh
                });
            });
        }

        // 2. Customers
        if (visibleOverlays.customers) {
            customers.forEach(cust => {
                allItems.push({
                    type: 'customer',
                    lat: cust.latitude,
                    lng: cust.longitude,
                    priority: cust.priority,
                    popupContent: `
                        <div>
                            <b style="color: #3b82f6; font-size: 0.85rem;">📍 Client: ${cust.name}</b>
                            <div style="margin-top: 6px;"><b>Priority:</b> ${cust.priority}</div>
                            <div><b>Address:</b> ${cust.address}</div>
                        </div>
                    `,
                    raw: cust
                });
            });
        }

        // 3. Vehicles
        if (visibleOverlays.vehicles) {
            vehicles.forEach(veh => {
                const activeTrip = trips.find(t => t.vehicleId === veh.id && ['Active', 'Assigned', 'In Transit', 'Delivering', 'Returning'].includes(t.status));
                if (!activeTrip) {
                    allItems.push({
                        type: 'vehicle',
                        lat: veh.latitude,
                        lng: veh.longitude,
                        status: veh.status,
                        popupContent: `
                            <div>
                                <b style="color: #06b6d4; font-size: 0.85rem;">🚚 Carrier: ${veh.vehicleNo}</b>
                                <div style="margin-top: 6px;"><b>Model:</b> ${veh.model}</div>
                                <div><b>Payload:</b> ${veh.capacity} kg</div>
                                <div><b>Status:</b> ${veh.status} (Idle)</div>
                            </div>
                        `,
                        raw: veh
                    });
                }
            });
        }

        // 4. Drivers
        if (visibleOverlays.drivers) {
            drivers.forEach(drv => {
                if (drv.gps && drv.status !== 'Offline') {
                    const activeTrip = trips.find(t => t.driverId === drv.id && ['Active', 'Assigned', 'In Transit', 'Delivering', 'Returning'].includes(t.status));
                    if (!activeTrip) {
                        const vehicleNo = drv.vehicleNo || 'None';
                        allItems.push({
                            type: 'driver',
                            lat: drv.gps.lat,
                            lng: drv.gps.lng,
                            status: drv.status,
                            popupContent: `
                                <div style="font-family: sans-serif; font-size: 0.8rem; line-height: 1.4; color: #f8fafc;">
                                    <div style="font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 4px; margin-bottom: 6px; color: #06b6d4; display: flex; align-items: center; justify-content: space-between;">
                                        <span>Driver Telemetry</span>
                                        <span style="font-size: 0.65rem; background: rgba(6,182,212,0.15); padding: 1px 5px; border-radius: 4px;">${drv.status}</span>
                                    </div>
                                    <div>👤 <b>Driver:</b> ${drv.name}</div>
                                    <div>🚚 <b>Vehicle:</b> ${vehicleNo}</div>
                                    <div>🔋 <b>Battery:</b> ${drv.batteryLevel}%</div>
                                    <div>⚡ <b>Speed:</b> ${drv.currentSpeed} km/h</div>
                                </div>
                            `,
                            raw: drv
                        });
                    }
                }
            });
        }

        // 5. Active/Travelling Trips (Live Driver Navigation Stream)
        const activeTrips = trips.filter(t => ['Active', 'Assigned', 'In Transit', 'Delivering', 'Returning'].includes(t.status));
        activeTrips.forEach(trip => {
            const drv = drivers.find(d => d.id === trip.driverId);
            const veh = vehicles.find(v => v.id === trip.vehicleId);

            let lat = drv?.gps?.lat || veh?.latitude || trip.expectedRoute?.[0]?.latitude || 13.08;
            let lng = drv?.gps?.lng || veh?.longitude || trip.expectedRoute?.[0]?.longitude || 80.27;

            let rotation = drv?.bearing !== undefined ? drv.bearing : 0;
            if (!rotation && trip.roadRoute && trip.roadRoute.length > 1) {
                const route = trip.roadRoute;
                const currentIdx = trip.currentRoadRouteIndex || 0;
                const pt1 = route[currentIdx];
                const pt2 = route[Math.min(route.length - 1, currentIdx + 1)];
                if (pt1 && pt2) {
                    const lat1 = pt1.latitude || pt1.lat;
                    const lon1 = pt1.longitude || pt1.lng;
                    const lat2 = pt2.latitude || pt2.lat;
                    const lon2 = pt2.longitude || pt2.lng;
                    if (lat1 && lon1 && lat2 && lon2) {
                        rotation = calculateBearing(lat1, lon1, lat2, lon2);
                    }
                }
            }

            allItems.push({
                type: 'traveling',
                lat,
                lng,
                rotation: Number(rotation) || 0,
                tripId: trip.id,
                driverName: drv?.name,
                vehicleNo: veh?.vehicleNo,
                battery: drv?.batteryLevel,
                speed: drv?.currentSpeed,
                popupContent: `
                    <div style="font-family: sans-serif; font-size: 0.8rem; line-height: 1.4; color: #f8fafc;">
                        <b style="color: #06b6d4; font-size: 0.85rem;">⚡ Live Mobile Navigation Stream</b>
                        <div style="margin-top: 6px;"><b>Driver:</b> ${drv?.name || 'Unknown'}</div>
                        <div><b>Vehicle:</b> ${veh?.vehicleNo || 'Unknown'}</div>
                        <div><b>Speed:</b> ${drv?.currentSpeed || 0} km/h</div>
                        <div><b>Battery:</b> ${drv?.batteryLevel || 100}%</div>
                        <div><b>ETA:</b> ${trip.expectedTime || 'N/A'} mins</div>
                    </div>
                `,
                raw: trip
            });
        });

        // 6. Traffic Congestions
        if (visibleOverlays.traffic) {
            trafficEvents.forEach(evt => {
                allItems.push({
                    type: 'traffic',
                    lat: evt.latitude,
                    lng: evt.longitude,
                    popupContent: `
                        <div>
                            <b style="color: #ef4444; font-size: 0.85rem;">⚠️ Traffic Congestion</b>
                            <div style="margin-top: 6px;"><b>Severity:</b> ${evt.severity}</div>
                            <div><b>Details:</b> ${evt.description}</div>
                        </div>
                    `,
                    raw: evt
                });
            });
        }

        // Proximity grouping
        const groups = [];
        const threshold = 0.0003;

        allItems.forEach(item => {
            let foundGroup = groups.find(g => {
                return Math.abs(item.lat - g.lat) < threshold && Math.abs(item.lng - g.lng) < threshold;
            });

            if (foundGroup) {
                foundGroup.items.push(item);
            } else {
                groups.push({
                    lat: item.lat,
                    lng: item.lng,
                    items: [item]
                });
            }
        });

        // Draw markers using Smooth 60 FPS LERP & Marker Reuse
        groups.forEach((group, groupIdx) => {
            const N = group.items.length;
            group.items.forEach((item, i) => {
                let finalLat = item.lat;
                let finalLng = item.lng;

                if (N > 1) {
                    const angle = (i * 2 * Math.PI) / N;
                    const radius = 0.00035; 
                    finalLat = group.lat + Math.cos(angle) * radius;
                    finalLng = group.lng + Math.sin(angle) * radius;
                }

                let markerIcon;
                if (item.type === 'warehouse') {
                    markerIcon = createSvgIcon('warehouse');
                } else if (item.type === 'customer') {
                    markerIcon = createSvgIcon('customer', item.raw.name, '', item.priority);
                } else if (item.type === 'traveling') {
                    markerIcon = createSvgIcon('traveling', '', 'Busy', '', item.rotation);
                } else if (item.type === 'vehicle') {
                    markerIcon = createSvgIcon('vehicle', '', item.status);
                } else if (item.type === 'driver') {
                    markerIcon = createSvgIcon('driver', '', item.status);
                } else if (item.type === 'traffic') {
                    markerIcon = createSvgIcon('traffic');
                }

                const markerKey = `item-${item.type}-${item.raw?.id || item.raw?._id || groupIdx}-${i}`;
                let marker = oldMarkersMap[markerKey];

                if (marker) {
                    // Update target coordinates for smooth 60 FPS LERP
                    animatedPositionsRef.current[markerKey] = {
                        currentLat: animatedPositionsRef.current[markerKey]?.currentLat || finalLat,
                        currentLng: animatedPositionsRef.current[markerKey]?.currentLng || finalLng,
                        targetLat: finalLat,
                        targetLng: finalLng
                    };
                    if (markerIcon) marker.setIcon(markerIcon);
                    delete oldMarkersMap[markerKey];
                } else {
                    marker = L.marker([finalLat, finalLng], { icon: markerIcon }).addTo(map);
                    animatedPositionsRef.current[markerKey] = {
                        currentLat: finalLat,
                        currentLng: finalLng,
                        targetLat: finalLat,
                        targetLng: finalLng
                    };
                    if (item.type === 'traveling') {
                        marker.on('click', () => {
                            setSelectedTripInfo(item);
                            if (onTripSelect) onTripSelect(item.tripId);
                        });
                    }
                }

                const popupContent = `
                    <div style="font-family: sans-serif; font-size: 0.8rem; line-height: 1.4; color: #f8fafc; background: #0f172a; border-radius: 8px; border: 1px solid #334155; padding: 10px; width: 220px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);">
                        ${item.popupContent}
                    </div>
                `;

                marker.bindPopup(popupContent, { maxWidth: 240 });
                newMarkersMap[markerKey] = marker;
            });
        });

        // Clean up removed markers
        Object.keys(oldMarkersMap).forEach(key => {
            map.removeLayer(oldMarkersMap[key]);
            delete animatedPositionsRef.current[key];
        });
        markersRef.current = newMarkersMap;

        // Clear old polylines
        Object.keys(polylinesRef.current).forEach(key => {
            map.removeLayer(polylinesRef.current[key]);
            delete polylinesRef.current[key];
        });

        // Render Navigation Route ONLY when a delivery is selected by Admin
        const selectedTrip = trips.find(t => t.id === selectedTripId || t.id === selectedTripInfo?.tripId || t.orderIds?.includes(selectedTripId));

        if (selectedTrip && (selectedTrip.status === 'Active' || selectedTrip.status === 'Assigned' || selectedTrip.status === 'In Transit' || selectedTrip.status === 'Returning')) {
            const isReturning = selectedTrip.status === 'Returning';

            // Render Quantum Planned Route (Blue dashed line)
            if (visibleOverlays.quantumRoute) {
                const rawRoute = routes?.quantumRoute || routes?.quantum?.route || routes?.routeDetails || selectedTrip.expectedRoute;
                if (rawRoute && rawRoute.length > 1) {
                    const points = rawRoute.map(node => [node.latitude || node.lat, node.longitude || node.lng]);
                    const polyline = L.polyline(points, {
                        color: '#3b82f6',
                        weight: 3.5,
                        opacity: 0.85,
                        dashArray: '8, 10'
                    }).addTo(map);
                    polylinesRef.current['quantumRoute'] = polyline;
                }
            }

            // Render Actual Turn-by-Turn Road Route & Dynamic Progress Trimming
            if (visibleOverlays.actualRoadRoute) {
                const rawRoad = routes?.actualRoadRoute || routes?.quantum?.roadRoute || routes?.roadRoute || selectedTrip.roadRoute;
                if (rawRoad && rawRoad.length > 1) {
                    const currentIdx = selectedTrip?.currentRoadRouteIndex || 0;

                    // 1. Completed Path (Muted translucent route line)
                    if (currentIdx > 0) {
                        const completedPts = rawRoad.slice(0, currentIdx + 1).map(node => [node.latitude || node.lat, node.longitude || node.lng]);
                        const completedPolyline = L.polyline(completedPts, {
                            color: '#64748b',
                            weight: 3.5,
                            opacity: 0.45
                        }).addTo(map);
                        polylinesRef.current['completedRoadRoute'] = completedPolyline;
                    }

                    // 2. Remaining Active Navigation Route (Vibrant Emerald for Outward / Cyan for Returning)
                    const remainingPts = rawRoad.slice(currentIdx).map(node => [node.latitude || node.lat, node.longitude || node.lng]);
                    if (remainingPts.length > 1) {
                        const remainingPolyline = L.polyline(remainingPts, {
                            color: isReturning ? '#06b6d4' : '#10b981',
                            weight: 5,
                            opacity: 0.95
                        }).addTo(map);
                        polylinesRef.current['actualRoadRoute'] = remainingPolyline;
                    }
                }
            }
        }

    }, [warehouses, customers, vehicles, drivers, trips, routes, activeStrategy, trafficEvents, visibleOverlays, onTripSelect, selectedTripId, selectedTripInfo]);

    const activeTrip = trips.find(t => (t.id === selectedTripId || t.orderIds?.includes(selectedTripId)) && (t.status === 'Active' || t.status === 'Assigned' || t.status === 'In Transit' || t.status === 'Returning'));
    const activeDriver = activeTrip ? drivers.find(d => d.id === activeTrip.driverId) : null;
    const activeVehicle = activeTrip ? vehicles.find(v => v.id === activeTrip.vehicleId) : null;

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Floating View Mode Selection Control */}
            <div style={{
                position: 'absolute',
                top: '12px',
                left: '60px',
                zIndex: 1000,
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '4px',
                display: 'flex',
                gap: '4px',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
            }}>
                {[
                    { id: 'roadmap', label: '🗺️ Roadmap' },
                    { id: 'satellite', label: '🛰️ Satellite' },
                    { id: 'terrain', label: '🏔️ Terrain' },
                    { id: 'hybrid', label: '🔀 Hybrid' }
                ].map(mode => (
                    <button
                        key={mode.id}
                        style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: mapMode === mode.id ? '#06b6d4' : 'transparent',
                            color: mapMode === mode.id ? '#fff' : '#94a3b8',
                            fontWeight: mapMode === mode.id ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontFamily: 'var(--font-display)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                        onClick={() => onMapModeChange && onMapModeChange(mode.id)}
                    >
                        {mode.label}
                    </button>
                ))}
            </div>

            {/* Desktop Floating Live Navigation Telemetry HUD (Matches Mobile Driver Screen HUD) */}
            {activeTrip && (
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    zIndex: 1000,
                    width: '310px',
                    background: 'rgba(15, 23, 42, 0.92)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    borderRadius: '12px',
                    padding: '14px',
                    color: '#f8fafc',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.6)',
                    fontFamily: 'sans-serif'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }}></span>
                            <b style={{ fontSize: '0.8rem', color: '#06b6d4' }}>LIVE NAVIGATION ENGINE</b>
                        </div>
                        <span style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>60 FPS ACTIVE</span>
                    </div>

                    <div style={{ fontSize: '0.8rem', lineHeight: '1.5' }}>
                        <div><b>👤 Driver:</b> {activeDriver?.name || 'Assigned Driver'}</div>
                        <div><b>🚚 Carrier:</b> {activeVehicle?.vehicleNo || 'Fleet Unit'}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <span>⚡ <b>Speed:</b> {activeDriver?.currentSpeed || 0} km/h</span>
                            <span>🔋 <b>Battery:</b> {activeDriver?.batteryLevel || 100}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                            <span>📏 <b>Distance:</b> {activeTrip.expectedDistance || 12.4} km</span>
                            <span>⏱️ <b>ETA:</b> {activeTrip.expectedTime || 18} mins</span>
                        </div>
                    </div>

                    {/* Navigation Progress Bar */}
                    <div style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8', marginBottom: '3px' }}>
                            <span>Progress</span>
                            <span>{Math.min(100, Math.round(((activeTrip.currentRoadRouteIndex || 0) / (activeTrip.roadRoute?.length || 10)) * 100))}%</span>
                        </div>
                        <div style={{ height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(100, Math.round(((activeTrip.currentRoadRouteIndex || 0) / (activeTrip.roadRoute?.length || 10)) * 100))}%`, background: '#10b981', transition: 'width 0.5s ease' }}></div>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Focus Label Indicator */}
            {focusLabel && !activeTrip && (
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    zIndex: 1000,
                    background: 'rgba(59, 130, 246, 0.15)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    color: '#3b82f6',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                }}>
                    🛰️ FOCUS: {focusLabel}
                </div>
            )}

            <div
                ref={mapContainerRef}
                style={{
                    height: '100%',
                    width: '100%',
                    backgroundColor: 'var(--bg-primary)'
                }}
            />
        </div>
    );
}
