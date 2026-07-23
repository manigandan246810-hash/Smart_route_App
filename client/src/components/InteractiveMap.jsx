import React, { useEffect, useRef } from 'react';
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
    onTripSelect
}) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const layersRef = useRef({});
    const markersRef = useRef({});
    const polylinesRef = useRef({});

    // SVG Custom Icons
    const createSvgIcon = (type, name = '', status = '', priority = '', rotation = 0) => {
        let svgHtml = '';

        if (type === 'warehouse') {
            // Hub Depot Broadcast symbol
            svgHtml = `
                <div style="background: rgba(16, 185, 129, 0.15); border: 2.2px solid #10b981; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px #10b981;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
                    <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/>
                    <circle cx="12" cy="12" r="2.5" fill="#10b981"/>
                    <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/>
                    <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1"/>
                  </svg>
                </div>
            `;
        } else if (type === 'customer') {
            // Client Pin Point
            const isHigh = priority === 'High';
            const borderClr = isHigh ? '#ef4444' : '#3b82f6';
            const fillClr = isHigh ? '#ef4444' : '#3b82f6';
            svgHtml = `
                <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${fillClr}" stroke="${borderClr}" stroke-width="1.5">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3.5" fill="#ffffff"></circle>
                  </svg>
                </div>
            `;
        } else if (type === 'traveling') {
            // Traveling Point Arrow
            svgHtml = `
                <div style="transform: rotate(${rotation - 90}deg); transition: transform 0.4s ease; background: rgba(15,23,42,0.9); border: 2px solid #3b82f6; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px #3b82f6;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#3b82f6" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                  </svg>
                </div>
            `;
        } else if (type === 'vehicle') {
            // Standard Vehicle icon
            const isBreakdown = status === 'Under Maintenance' || status === 'Broken';
            const fillClr = isBreakdown ? '#ef4444' : '#06b6d4';
            const pulseClass = isBreakdown ? 'animate-pulse' : '';
            svgHtml = `
                <div class="${pulseClass}" style="background: rgba(255,255,255,0.9); border: 1.8px solid ${fillClr}; border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 6px ${fillClr};">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${fillClr}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="1" y="3" width="15" height="13"></rect>
                    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                    <circle cx="5.5" cy="18.5" r="2.5"></circle>
                    <circle cx="18.5" cy="18.5" r="2.5"></circle>
                  </svg>
                </div>
            `;
        } else if (type === 'driver') {
            // Standard Driver icon
            const isOnline = status === 'Online' || status === 'Available';
            const color = isOnline ? '#10b981' : (status === 'Suspended' ? '#6b7280' : '#ef4444');
            svgHtml = `
                <div style="background: rgba(255,255,255,0.9); border: 1.8px solid ${color}; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 6px ${color}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
            `;
        } else if (type === 'traffic') {
            svgHtml = `
                <div style="background: rgba(239, 68, 68, 0.4); border: 2.2px solid #ef4444; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px #ef4444;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                </div>
            `;
        }

        const isMoving = type === 'traveling';
        return L.divIcon({
            html: svgHtml,
            className: `custom-quantum-icon ${isMoving ? 'animate-marker-motion' : ''}`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
    };

    // Initialize Map
    useEffect(() => {
        if (!mapRef.current && mapContainerRef.current) {
            const map = L.map(mapContainerRef.current, {
                zoomControl: true,
                attributionControl: false
            }).setView([13.045, 80.25], 12.5);

            // Define Layers
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

    // Center map reactively
    useEffect(() => {
        if (!mapRef.current) return;
        const target = centerOn || {};
        const lat = target.latitude || target.lat;
        const lng = target.longitude || target.lng;
        if (lat && lng) {
            mapRef.current.setView([lat, lng], 14, { animate: true });
        }
    }, [centerOn]);

    // Sync Map base Tile Layer
    useEffect(() => {
        if (!mapRef.current || !layersRef.current) return;
        const map = mapRef.current;

        Object.values(layersRef.current).forEach(layer => {
            if (map.hasLayer(layer)) map.removeLayer(layer);
        });

        const selectedLayer = layersRef.current[mapMode] || layersRef.current.roadmap;
        selectedLayer.addTo(map);

        if (mapMode === 'roadmap' || mapMode === 'terrain') {
            mapContainerRef.current.className = 'dark-map';
        } else {
            mapContainerRef.current.className = '';
        }
    }, [mapMode]);

    // Sync Markers and routes
    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        // Clear old markers
        Object.keys(markersRef.current).forEach(key => {
            map.removeLayer(markersRef.current[key]);
            delete markersRef.current[key];
        });

        const allItems = [];

        // 1. Warehouses (Hubs)
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

        // 2. Clients (Customers)
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

        // 3. Vehicles (Only if stationary/idle)
        if (visibleOverlays.vehicles) {
            vehicles.forEach(veh => {
                const activeTrip = trips.find(t => t.vehicleId === veh.id && (t.status === 'Active' || t.status === 'Assigned'));
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

        // 4. Drivers (Only if stationary/idle and not Offline)
        if (visibleOverlays.drivers) {
            drivers.forEach(drv => {
                if (drv.gps && drv.status !== 'Offline') {
                    const activeTrip = trips.find(t => t.driverId === drv.id && (t.status === 'Active' || t.status === 'Assigned'));
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

        // 5. Active/Travelling Trips
        const activeTrips = trips.filter(t => t.status === 'Active' || t.status === 'Assigned');
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

            const orderIdsText = trip.orderIds ? trip.orderIds.join(', ') : 'None';

            allItems.push({
                type: 'traveling',
                lat,
                lng,
                rotation,
                tripId: trip.id,
                popupContent: `
                    <div style="font-family: sans-serif; font-size: 0.8rem; line-height: 1.4; color: #f8fafc;">
                        <b style="color: #3b82f6; font-size: 0.85rem;">⚡ Active Travelling Dispatch</b>
                        <div style="margin-top: 6px;"><b>Driver:</b> ${drv?.name || 'Unknown'}</div>
                        <div><b>Vehicle:</b> ${veh?.vehicleNo || 'Unknown'}</div>
                        <div><b>Orders:</b> ${orderIdsText}</div>
                        <div><b>ETA:</b> ${trip.expectedTime || 'N/A'} mins</div>
                        <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 4px;">Click point to view full live details card</div>
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

        // Proximity grouping (group coordinates closer than ~30 meters)
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

        // Draw groups with circular dispersion layout (no folders, no tabs!)
        groups.forEach((group, groupIdx) => {
            const N = group.items.length;
            group.items.forEach((item, i) => {
                let finalLat = item.lat;
                let finalLng = item.lng;

                if (N > 1) {
                    // Spread items around the center coordinate in a small circle (radius ~30 meters)
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

                const marker = L.marker([finalLat, finalLng], {
                    icon: markerIcon
                }).addTo(map);

                // If traveling point, hook click listener to select trip in live delivery card
                if (item.type === 'traveling') {
                    marker.on('click', () => {
                        if (onTripSelect) {
                            onTripSelect(item.tripId);
                        }
                    });
                }

                const popupContent = `
                    <div style="font-family: sans-serif; font-size: 0.8rem; line-height: 1.4; color: #f8fafc; background: #0f172a; border-radius: 8px; border: 1px solid #334155; padding: 10px; width: 220px; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);">
                        ${item.popupContent}
                    </div>
                `;

                marker.bindPopup(popupContent, { maxWidth: 240 });
                markersRef.current[`item-${item.type}-${item.raw.id || item.raw._id || groupIdx}-${i}`] = marker;
            });
        });

        // Clear old polylines
        Object.keys(polylinesRef.current).forEach(key => {
            map.removeLayer(polylinesRef.current[key]);
            delete polylinesRef.current[key];
        });

        if (visibleOverlays.quantumRoute) {
            const rawRoute = routes?.quantumRoute || routes?.quantum?.route || routes?.routeDetails;
            if (rawRoute && rawRoute.length > 1) {
                const points = rawRoute.map(node => [node.latitude, node.longitude]);
                const polyline = L.polyline(points, {
                    color: '#3b82f6',
                    weight: 3.5,
                    opacity: 0.85,
                    dashArray: '8, 10'
                }).addTo(map);
                polylinesRef.current['quantumRoute'] = polyline;
            }
        }

        if (visibleOverlays.actualRoadRoute) {
            const rawRoad = routes?.actualRoadRoute || routes?.quantum?.roadRoute || routes?.roadRoute;
            if (rawRoad && rawRoad.length > 1) {
                const points = rawRoad.map(node => [node.latitude, node.longitude]);
                const polyline = L.polyline(points, {
                    color: '#10b981',
                    weight: 5,
                    opacity: 0.95
                }).addTo(map);
                polylinesRef.current['actualRoadRoute'] = polyline;
            }
        }

    }, [warehouses, customers, vehicles, drivers, trips, routes, activeStrategy, trafficEvents, visibleOverlays, onTripSelect]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Floating View Mode Selection Control */}
            <div style={{
                position: 'absolute',
                top: '10px',
                left: '60px',
                zIndex: 1000,
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(10px)',
                border: '1px solid var(--border-glow)',
                borderRadius: '8px',
                padding: '4px',
                display: 'flex',
                gap: '4px',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)'
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
                            color: mapMode === mode.id ? '#fff' : 'var(--text-muted)',
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

            {/* Floating Focus Label Indicator */}
            {focusLabel && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
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
