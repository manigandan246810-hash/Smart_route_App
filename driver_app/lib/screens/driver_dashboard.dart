import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:http/http.dart' as http;
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:shared_preferences/shared_preferences.dart';
import 'login_screen.dart';

class DriverDashboard extends StatefulWidget {
  final String token;
  final String userJson;
  final String serverUrl;

  const DriverDashboard({
    super.key,
    required this.token,
    required this.userJson,
    required this.serverUrl,
  });

  @override
  State<DriverDashboard> createState() => _DriverDashboardState();
}

class _DriverDashboardState extends State<DriverDashboard> with SingleTickerProviderStateMixin {
  late Map<String, dynamic> _user;
  Map<String, dynamic>? _activeTripInfo;
  List<dynamic> _notificationsQueue = [];
  final Set<String> _hiddenNotifIds = {};
  bool _isLoading = false;
  int _gpsSimIndex = 0;
  int _batteryLevel = 85;
  String _networkStatus = 'Excellent';
  int _currentSpeed = 0;
  Timer? _pollingTimer;
  Timer? _statsTimer;
  Timer? _movementTimer;
  IO.Socket? _socket;
  final MapController _mapController = MapController();
  bool _isMapFullscreen = false;
  String _mapStyle = 'road'; // 'road', 'hybrid', 'dark'

  // Smooth Google Maps-like 60 FPS Location & Bearing Animation
  late AnimationController _animController;
  LatLng _animatedPos = const LatLng(13.045, 80.25);
  LatLng _startPos = const LatLng(13.045, 80.25);
  LatLng _targetPos = const LatLng(13.045, 80.25);
  double _animatedBearing = 0.0;
  double _startBearing = 0.0;
  double _targetBearing = 0.0;

  // Calculates travel bearing in degrees (0-360) between start and end coordinates
  double _calculateBearing(LatLng start, LatLng end) {
    final lat1 = start.latitude * math.pi / 180;
    final lng1 = start.longitude * math.pi / 180;
    final lat2 = end.latitude * math.pi / 180;
    final lng2 = end.longitude * math.pi / 180;

    final dLng = lng2 - lng1;
    final y = math.sin(dLng) * math.cos(lat2);
    final x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dLng);

    final radians = math.atan2(y, x);
    return (radians * 180 / math.pi + 360) % 360;
  }

  // Interpolates rotation angle using shortest angular distance path
  double _lerpAngle(double start, double end, double t) {
    double difference = (end - start) % 360;
    if (difference > 180) difference -= 360;
    if (difference < -180) difference += 360;
    return (start + difference * t) % 360;
  }

  // Smoothly animates position and bearing over 1.8s at 60 FPS
  void _animateToPosition(LatLng newTargetPos) {
    if (newTargetPos.latitude == _animatedPos.latitude && newTargetPos.longitude == _animatedPos.longitude) return;

    final newBearing = _calculateBearing(_animatedPos, newTargetPos);

    _startPos = _animatedPos;
    _targetPos = newTargetPos;
    _startBearing = _animatedBearing;
    _targetBearing = newBearing;

    _animController.stop();
    _animController.forward(from: 0.0);
  }

  void _recenterMap(LatLng target) {
    try {
      final currentZoom = _mapController.camera.zoom;
      _mapController.move(target, currentZoom);
    } catch (_) {
      _mapController.move(target, 14.5);
    }
  }

  Widget _buildMapStyleChip(String style, String label, IconData icon) {
    final isSelected = _mapStyle == style;
    return GestureDetector(
      onTap: () {
        setState(() {
          _mapStyle = style;
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF06B6D4) : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 12, color: isSelected ? Colors.black : Colors.white70),
            const SizedBox(width: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                color: isSelected ? Colors.black : Colors.white70,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    _user = jsonDecode(widget.userJson);

    // Initialize 60 FPS animation controller with easeInOut curve
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );

    _animController.addListener(() {
      if (!mounted) return;
      final t = Curves.easeInOut.transform(_animController.value);
      final lat = _startPos.latitude + (_targetPos.latitude - _startPos.latitude) * t;
      final lng = _startPos.longitude + (_targetPos.longitude - _startPos.longitude) * t;

      final newBearing = _lerpAngle(_startBearing, _targetBearing, t);

      setState(() {
        _animatedPos = LatLng(lat, lng);
        _animatedBearing = newBearing;
      });

      // Stream high-frequency live GPS & Bearing to backend so Admin map arrow moves in 1:1 perfect sync
      if (_socket != null && _socket!.connected) {
        _socket!.emit('driver:location_update', {
          'driverId': _user['id'],
          'tripId': _activeTripInfo?['trip']?['id'],
          'gps': {'lat': lat, 'lng': lng},
          'bearing': newBearing,
          'speed': _currentSpeed > 0 ? _currentSpeed : 38,
          'batteryLevel': _batteryLevel,
          'networkStatus': _networkStatus,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
        });
      }

      // Throttle camera pan updates to prevent tile re-render jitter
      if ((_animController.value * 10).floor() % 3 == 0) {
        try {
          _mapController.move(_animatedPos, _mapController.camera.zoom);
        } catch (_) {}
      }
    });

    _fetchActiveTrip();

    // Start background sync polling every 4 seconds
    _pollingTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      _fetchActiveTrip();
    });

    // Mock stats updates every 8 seconds
    _statsTimer = Timer.periodic(const Duration(seconds: 8), (timer) {
      if (mounted) {
        setState(() {
          _batteryLevel = (_batteryLevel - (1.0 * (0.1 + 0.1 * (1.0 - 0.5))).round()).clamp(15, 100);
          _networkStatus = (1.0 * 0.9 > 0.85) ? 'Excellent' : 'Good';
          _currentSpeed = _activeTripInfo?['trip']?['status'] == 'Active' ? 35 + (1.0 * 20).round() : 0;
        });
      }
    });

    _initSocket();
  }

  @override
  void dispose() {
    _animController.dispose();
    _pollingTimer?.cancel();
    _statsTimer?.cancel();
    _movementTimer?.cancel();
    _socket?.disconnect();
    _socket?.dispose();
    super.dispose();
  }

  void _initSocket() {
    _socket = IO.io(widget.serverUrl, IO.OptionBuilder()
        .setTransports(['websocket'])
        .enableAutoConnect()
        .build());

    _socket!.onConnect((_) {
      print('Socket connection established with backend.');
      _socket!.emit('join', {'userId': _user['id'], 'role': 'driver'});
    });

    _socket!.onDisconnect((_) {
      print('Disconnected from socket.');
    });

    _socket!.on('dispatch:notification', (data) {
      if (mounted) {
        setState(() {
          // Prevent duplicates
          final orderId = data['orderId'];
          if (!_notificationsQueue.any((n) => n['orderId'] == orderId)) {
            _notificationsQueue = [data, ..._notificationsQueue];
          }
        });
      }
    });

    _socket!.on('dispatch:accepted', (data) {
      if (mounted) {
        setState(() {
          final orderId = data['orderId'];
          _notificationsQueue = _notificationsQueue.map((n) {
            if (n['orderId'] == orderId) {
              return {
                ...n,
                'isAcceptedByOther': true,
                'acceptedByName': data['driverName'],
              };
            }
            return n;
          }).toList();
        });
      }
      _fetchActiveTrip();
    });

    _socket!.on('dispatch:recovery_notification', (data) {
      if (mounted) {
        setState(() {
          final breakdownId = data['breakdownId'];
          if (!_notificationsQueue.any((n) => n['breakdownId'] == breakdownId)) {
            _notificationsQueue = [data, ..._notificationsQueue];
          }
        });
      }
    });

    _socket!.on('dispatch:recovery_accepted', (data) {
      if (mounted) {
        setState(() {
          final breakdownId = data['breakdownId'];
          _notificationsQueue = _notificationsQueue.map((n) {
            if (n['breakdownId'] == breakdownId) {
              return {
                ...n,
                'isAcceptedByOther': true,
                'acceptedByName': data['driverName'],
              };
            }
            return n;
          }).toList();
        });
      }
      _fetchActiveTrip();
    });

    _socket!.on('dispatch:auto_assigned_alert', (data) {
      if (mounted) {
        _showAlertDialog('🚨 System Alert', data['message']);
      }
      _fetchActiveTrip();
    });

    _socket!.on('route:rerouted', (data) {
      if (mounted) {
        final tripId = data['tripId'];
        if (_activeTripInfo?['trip']?['id'] == tripId) {
          setState(() {
            _activeTripInfo!['trip']['roadRoute'] = data['roadRoute'];
            _gpsSimIndex = 0;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Row(
                children: [
                  const Icon(Icons.alt_route, color: Colors.black, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '⚡ ${data['reason'] ?? "AI Dynamic Reroute Applied!"}',
                      style: const TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
              backgroundColor: const Color(0xFF06B6D4),
              behavior: SnackBarBehavior.floating,
              duration: const Duration(seconds: 4),
            ),
          );
        }
      }
    });
  }

  bool _isAutoDriving = true;

  void _startMovementTimer() {
    if (_movementTimer != null && _movementTimer!.isActive) return;

    _movementTimer = Timer.periodic(const Duration(milliseconds: 1500), (timer) {
      if (!mounted) return;
      if (!_isAutoDriving) return;

      final trip = _activeTripInfo?['trip'];
      final status = trip?['status'];
      if (trip == null || (status != 'Active' && status != 'Assigned' && status != 'In Transit')) {
        _movementTimer?.cancel();
        _movementTimer = null;
        return;
      }

      final roadRoute = trip['roadRoute'] as List?;
      if (roadRoute == null || roadRoute.isEmpty) return;

      setState(() {
        _gpsSimIndex = (_gpsSimIndex + 1) % roadRoute.length;
      });

      final currentPos = roadRoute[_gpsSimIndex];
      final lat = currentPos['latitude'] as num?;
      final lng = currentPos['longitude'] as num?;

      if (lat != null && lng != null) {
        final newTargetPos = LatLng(lat.toDouble(), lng.toDouble());
        _animateToPosition(newTargetPos);

        final speed = 35 + (_gpsSimIndex % 20);
        final payload = {
          'driverId': _user['id'],
          'tripId': trip['id'],
          'gps': {'lat': lat.toDouble(), 'lng': lng.toDouble()},
          'bearing': _animatedBearing,
          'speed': speed,
          'batteryLevel': _batteryLevel,
          'networkStatus': _networkStatus,
          'timestamp': DateTime.now().millisecondsSinceEpoch,
        };

        // 1. Stream via WebSockets (Single Source of Truth)
        _socket?.emit('driver:location_update', payload);

        // 2. Stream via REST HTTP API
        http.post(
          Uri.parse('${widget.serverUrl}/api/drivers/${_user['id']}/location'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${widget.token}',
          },
          body: jsonEncode({
            'gps': {'lat': lat.toDouble(), 'lng': lng.toDouble()},
            'speed': speed,
            'batteryLevel': _batteryLevel,
          }),
        ).catchError((_) => http.Response('', 500));

        // 3. Auto-Deliver Items when cursor arrives at customer delivery coordinates
        final orders = _activeTripInfo?['orders'] as List?;
        if (orders != null) {
          for (var order in orders) {
            if (order['status'] != 'Completed') {
              final cust = order['customer'];
              if (cust != null) {
                final cLat = cust['latitude'] as num?;
                final cLng = cust['longitude'] as num?;
                if (cLat != null && cLng != null) {
                  final dist = math.sqrt(
                    math.pow(lat - cLat, 2) + math.pow(lng - cLng, 2)
                  );
                  // Arrival proximity threshold (~250-300 meters)
                  if (dist < 0.0035) {
                    _handleCompleteOrderNode(order['id']);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Row(
                          children: [
                            const Icon(Icons.check_circle, color: Colors.white, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '📦 Delivered Order to ${cust['name']}!',
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                        backgroundColor: const Color(0xFF10B981),
                        behavior: SnackBarBehavior.floating,
                        duration: const Duration(seconds: 3),
                      ),
                    );
                    break;
                  }
                }
              }
            }
          }
        }
      }
    });
  }

  Future<void> _fetchActiveTrip() async {
    try {
      final res = await http.get(
        Uri.parse('${widget.serverUrl}/api/driver/trip'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (mounted) {
          setState(() {
            _activeTripInfo = data;
          });
          final tripStatus = data?['trip']?['status'];
          if (tripStatus == 'Active' || tripStatus == 'Assigned' || tripStatus == 'In Transit') {
            final roadRoute = data['trip']['roadRoute'] as List?;
            if (roadRoute != null && roadRoute.isNotEmpty) {
              final firstPoint = roadRoute[_gpsSimIndex.clamp(0, roadRoute.length - 1)];
              final fLat = firstPoint['latitude'] as num?;
              final fLng = firstPoint['longitude'] as num?;
              if (fLat != null && fLng != null) {
                final targetPos = LatLng(fLat.toDouble(), fLng.toDouble());
                _animatedPos = targetPos;
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  try {
                    final currentZoom = _mapController.camera.zoom;
                    _mapController.move(targetPos, currentZoom);
                  } catch (_) {}
                });
              }
            }
            _startMovementTimer();
          }
        }
      }
    } catch (e) {
      print('Error polling active trip: $e');
    }
  }

  void _showAlertDialog(String title, String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK', style: TextStyle(color: Color(0xFF06B6D4))),
          ),
        ],
      ),
    );
  }

  Future<void> _handleLogout() async {
    if (_activeTripInfo?['trip']?['status'] == 'Active') {
      _showAlertDialog('Action Denied', 'You cannot log out with an active trip in progress.');
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('user');

    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => LoginScreen(initialServerUrl: widget.serverUrl),
        ),
      );
    }
  }

  Future<void> _handleTripResponse(String action) async {
    if (_activeTripInfo?['trip'] == null) return;
    setState(() => _isLoading = true);

    try {
      final res = await http.post(
        Uri.parse('${widget.serverUrl}/api/driver/trip/respond'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: jsonEncode({
          'tripId': _activeTripInfo!['trip']['id'],
          'action': action,
        }),
      );
      if (res.statusCode == 200) {
        setState(() {
          _notificationsQueue.clear();
          _gpsSimIndex = 0;
        });
        _fetchActiveTrip();
      } else {
        final errData = jsonDecode(res.body);
        _showAlertDialog('Error', errData['message'] ?? 'Failed to respond to assignment.');
      }
    } catch (e) {
      _showAlertDialog('Connection Error', 'Failed to reach server: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleAcceptOrder(String orderId) async {
    setState(() => _isLoading = true);
    try {
      final res = await http.post(
        Uri.parse('${widget.serverUrl}/api/orders/$orderId/accept'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );
      if (res.statusCode == 200) {
        setState(() {
          _notificationsQueue.clear();
          _gpsSimIndex = 0;
        });
        _fetchActiveTrip();
      } else {
        final data = jsonDecode(res.body);
        _showAlertDialog('Error', data['message'] ?? 'Failed to accept order.');
      }
    } catch (e) {
      _showAlertDialog('Connection Error', '$e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _handleAcceptRecovery(String breakdownId) async {
    setState(() => _isLoading = true);
    try {
      final res = await http.post(
        Uri.parse('${widget.serverUrl}/api/breakdowns/$breakdownId/accept'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );
      if (res.statusCode == 200) {
        setState(() {
          _notificationsQueue.clear();
          _gpsSimIndex = 0;
        });
        _fetchActiveTrip();
      } else {
        final data = jsonDecode(res.body);
        _showAlertDialog('Error', data['message'] ?? 'Failed to accept recovery.');
      }
    } catch (e) {
      _showAlertDialog('Connection Error', '$e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _handleRejectRequest(String? id) {
    if (id == null) return;
    setState(() {
      _hiddenNotifIds.add(id);
    });
  }

  Future<void> _handleReportRoadblockSOS() async {
    if (_activeTripInfo?['trip'] == null) return;
    final roadRoute = _activeTripInfo!['trip']['roadRoute'] as List?;
    if (roadRoute == null || roadRoute.isEmpty) return;

    final currentLoc = roadRoute[(_gpsSimIndex).clamp(0, roadRoute.length - 1)];

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('🚨 SOS Obstacle Report'),
        content: const Text('Are you sure you want to report a severe roadblock / traffic obstacle at your current location?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Report', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        final res = await http.post(
          Uri.parse('${widget.serverUrl}/api/events/traffic'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${widget.token}',
          },
          body: jsonEncode({
            'latitude': currentLoc['latitude'],
            'longitude': currentLoc['longitude'],
            'severity': 'High',
            'description': 'SOS: Obstacle reported by driver ${_user['name']}',
          }),
        );
        if (res.statusCode == 200) {
          _showAlertDialog('Success', 'SOS Roadblock registered successfully.');
        }
      } catch (e) {
        _showAlertDialog('Error', 'Failed to send roadblock SOS: $e');
      }
    }
  }

  Future<void> _handleReportBreakdown() async {
    if (_activeTripInfo?['trip'] == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('💥 Report Vehicle Breakdown'),
        content: const Text('This will set vehicle status to Breakdown, notify dispatcher, and request recovery from other available drivers. Proceed?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Report Breakdown', style: TextStyle(color: Colors.orange)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      try {
        final res = await http.post(
          Uri.parse('${widget.serverUrl}/api/driver/trip/breakdown'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${widget.token}',
          },
          body: jsonEncode({
            'tripId': _activeTripInfo!['trip']['id'],
            'description': 'Breakdown reported by driver ${_user['name']}.',
          }),
        );
        if (res.statusCode == 200) {
          _showAlertDialog('Reported', 'Breakdown registered. Recovery dispatch triggered.');
          _fetchActiveTrip();
        }
      } catch (e) {
        _showAlertDialog('Error', 'Failed to submit breakdown: $e');
      }
    }
  }

  Future<void> _handleCompleteOrderNode(String orderId) async {
    try {
      final res = await http.post(
        Uri.parse('${widget.serverUrl}/api/driver/trip/complete-node'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: jsonEncode({'orderId': orderId}),
      );
      if (res.statusCode == 200) {
        setState(() {
          _gpsSimIndex++;
        });
        _fetchActiveTrip();
      }
    } catch (e) {
      print('Error completing manifest node: $e');
    }
  }

  Future<void> _handleSimulateGPSUpdate() async {
    final trip = _activeTripInfo?['trip'];
    if (trip == null) return;
    final roadRoute = trip['roadRoute'] as List?;
    if (roadRoute == null || roadRoute.isEmpty) return;

    final maxIdx = roadRoute.length - 1;
    if (_gpsSimIndex < maxIdx) {
      setState(() {
        _gpsSimIndex = (_gpsSimIndex + 2).clamp(0, maxIdx);
        _currentSpeed = 45;
      });

      final currentLoc = roadRoute[_gpsSimIndex];
      try {
        await http.post(
          Uri.parse('${widget.serverUrl}/api/driver/location'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${widget.token}',
          },
          body: jsonEncode({
            'lat': currentLoc['latitude'],
            'lng': currentLoc['longitude'],
            'speed': _currentSpeed,
            'battery': _batteryLevel,
            'network': _networkStatus,
          }),
        );

        // Center map on new location
        _mapController.move(
          LatLng((currentLoc['latitude'] as num).toDouble(), (currentLoc['longitude'] as num).toDouble()),
          _mapController.camera.zoom,
        );
      } catch (e) {
        print('GPS sync telemetry failed: $e');
      }
    } else {
      _showAlertDialog('Depot Reached', 'You have arrived back at the Depot!');
    }
  }

  @override
  Widget build(BuildContext context) {
    final trip = _activeTripInfo?['trip'];
    final status = trip?['status'];

    return Scaffold(
      appBar: _isMapFullscreen
          ? null
          : AppBar(
              backgroundColor: const Color(0xFF1E293B),
              title: Row(
                children: [
                  const Icon(Icons.local_shipping, color: Color(0xFF06B6D4), size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'SmartRoute ',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const Text(
                    'Driver',
                    style: TextStyle(color: Color(0xFF06B6D4), fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ],
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.logout, color: Color(0xFFEF4444)),
                  onPressed: _isLoading ? null : _handleLogout,
                  tooltip: 'Logout',
                ),
              ],
            ),
      body: Stack(
        children: [
          Column(
            children: [
              // Device Stats Bar (Simulated phone status)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                color: const Color(0xFF0F172A),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.signal_cellular_alt, size: 12, color: Color(0xFF06B6D4)),
                        const SizedBox(width: 4),
                        Text(_networkStatus, style: const TextStyle(fontSize: 10)),
                      ],
                    ),
                    Row(
                      children: [
                        const Icon(Icons.battery_std, size: 12, color: Color(0xFF10B981)),
                        const SizedBox(width: 4),
                        Text('$_batteryLevel%', style: const TextStyle(fontSize: 10)),
                      ],
                    ),
                  ],
                ),
              ),

              // User info Card
              Padding(
                padding: const EdgeInsets.all(12.0),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: const Color(0xFF3B82F6).withOpacity(0.15),
                          ),
                          child: const Icon(Icons.person, color: Color(0xFF3B82F6), size: 20),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _user['name'] ?? 'Driver Profile',
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Active Vehicle: ${_activeTripInfo?['vehicle']?['vehicleNo'] ?? "None"}',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // Expanded Content Area
              Expanded(
                child: _buildMainContent(status),
              ),
            ],
          ),

          // YouTube-Style Full-Screen Map Overlay (100% Full Width & Height Overlay)
          if (_isMapFullscreen)
            Positioned.fill(
              child: Container(
                color: const Color(0xFF0F172A),
                child: SafeArea(
                  child: _buildMapViewComponent(isFullScreen: true),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMainContent(String? status) {
    final trip = _activeTripInfo?['trip'];
    if (trip != null) {
      if (status == 'Assigned') {
        // Workflow: Pending Assignment screen
        return _buildPendingAssignmentScreen();
      } else if (status == 'Active') {
        // Workflow: Active driving trip
        return _buildActiveTripScreen();
      }
    }

    // No active trip: show notifications queue or default empty screen
    return _buildIdleQueueScreen();
  }

  Widget _buildPendingAssignmentScreen() {
    final warehouse = _activeTripInfo?['warehouse']?['name'] ?? 'Depot';
    final stopCount = _activeTripInfo?['orders']?.length ?? 0;
    final distance = _activeTripInfo?['trip']?['expectedDistance'] ?? 0;
    final time = _activeTripInfo?['trip']?['expectedTime'] ?? 0;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFF8B5CF6), width: 1.5),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF8B5CF6).withOpacity(0.1),
                blurRadius: 10,
                spreadRadius: 2,
              )
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.notifications_active, color: Color(0xFF8B5CF6), size: 48),
              const SizedBox(height: 12),
              const Text(
                'New Delivery Assigned',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF8B5CF6)),
              ),
              const SizedBox(height: 8),
              const Text(
                'A quantum route has been calculated for your load!',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
              ),
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Source: $warehouse', style: const TextStyle(fontSize: 12)),
                    const SizedBox(height: 6),
                    Text('Destinations: $stopCount Stop(s)', style: const TextStyle(fontSize: 12)),
                    const SizedBox(height: 6),
                    Text('Distance: $distance km', style: const TextStyle(fontSize: 12)),
                    const SizedBox(height: 6),
                    Text('Expected Time: $time Mins', style: const TextStyle(fontSize: 12)),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : () => _handleTripResponse('reject'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        foregroundColor: Colors.red,
                        side: const BorderSide(color: Colors.red),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: const Text('Reject', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : () => _handleTripResponse('accept'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF06B6D4),
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      child: const Text('Accept', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              )
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActiveTripScreen() {
    final roadRoute = _activeTripInfo?['trip']?['roadRoute'] as List?;
    final ordersList = _activeTripInfo?['orders'] as List?;

    final safeIdxString = roadRoute != null && roadRoute.isNotEmpty
        ? 'Index $_gpsSimIndex / ${roadRoute.length - 1}'
        : 'Unknown';

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Inline Map Component (210px height when minimized)
          SizedBox(
            height: 210.0,
            child: _buildMapViewComponent(isFullScreen: false),
          ),
          const SizedBox(height: 12),

          // Control dashboard panel
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _handleReportRoadblockSOS,
                          icon: const Icon(Icons.whatshot, size: 14),
                          label: const Text('SOS Traffic', style: TextStyle(fontSize: 11)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            foregroundColor: Colors.red,
                            side: const BorderSide(color: Colors.red),
                            minimumSize: const Size.fromHeight(36),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: _handleReportBreakdown,
                          icon: const Icon(Icons.error_outline, size: 14),
                          label: const Text('Breakdown', style: TextStyle(fontSize: 11)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            foregroundColor: Colors.orange,
                            side: const BorderSide(color: Colors.orange),
                            minimumSize: const Size.fromHeight(36),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // Auto-Drive & Deliver Movement Controls
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: _isAutoDriving ? const Color(0xFF10B981) : const Color(0xFF334155)),
                    ),
                    child: Row(
                      children: [
                        ElevatedButton.icon(
                          onPressed: () {
                            setState(() {
                              _isAutoDriving = !_isAutoDriving;
                            });
                          },
                          icon: Icon(_isAutoDriving ? Icons.pause : Icons.play_arrow, size: 16),
                          label: Text(
                            _isAutoDriving ? 'Pause Travel' : 'Auto-Drive & Deliver',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _isAutoDriving ? const Color(0xFF10B981) : const Color(0xFF06B6D4),
                            foregroundColor: Colors.black,
                            minimumSize: const Size(130, 32),
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () {
                              if (roadRoute != null && roadRoute.isNotEmpty) {
                                setState(() {
                                  _gpsSimIndex = (_gpsSimIndex + 1) % roadRoute.length;
                                });
                                final currentPos = roadRoute[_gpsSimIndex];
                                final lat = currentPos['latitude'] as num?;
                                final lng = currentPos['longitude'] as num?;
                                if (lat != null && lng != null) {
                                  _animateToPosition(LatLng(lat.toDouble(), lng.toDouble()));
                                }
                              }
                            },
                            icon: const Icon(Icons.fast_forward, size: 14),
                            label: const Text('Step +1', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF06B6D4),
                              side: const BorderSide(color: Color(0xFF06B6D4)),
                              minimumSize: const Size.fromHeight(32),
                              padding: EdgeInsets.zero,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 7,
                            height: 7,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: _isAutoDriving ? const Color(0xFF10B981) : Colors.amber,
                            ),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            _isAutoDriving ? '60 FPS Gliding • $safeIdxString' : 'Paused • $safeIdxString',
                            style: TextStyle(fontSize: 10, color: _isAutoDriving ? const Color(0xFF10B981) : Colors.amber, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      Text(
                        'Speed: $_currentSpeed km/h',
                        style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)),
                      ),
                    ],
                  )
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // 3. Manifest Drops
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 4.0),
            child: Text(
              'Delivery Manifest Nodes',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 8),
          if (ordersList != null)
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: ordersList.length,
              itemBuilder: (context, idx) {
                final order = ordersList[idx];
                final isCompleted = order['status'] == 'Completed';
                final customer = order['customer'] ?? {};

                return Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isCompleted ? Colors.green.withOpacity(0.06) : const Color(0xFF1E293B),
                    border: Border.all(
                      color: isCompleted ? Colors.green.withOpacity(0.2) : const Color(0xFF334155),
                    ),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${idx + 1}. ${customer['name'] ?? "Customer"}',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: isCompleted ? Colors.grey : Colors.white,
                                decoration: isCompleted ? TextDecoration.lineThrough : null,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              customer['address'] ?? '',
                              style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (!isCompleted)
                        ElevatedButton(
                          onPressed: () => _handleCompleteOrderNode(order['id']),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF10B981),
                            foregroundColor: Colors.white,
                            minimumSize: const Size(60, 28),
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                          ),
                          child: const Text('Deliver', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                        )
                      else
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.check_circle_outline, color: Color(0xFF10B981), size: 14),
                                SizedBox(width: 4),
                                Text('Done', style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.bold)),
                              ],
                            ),
                            if (order['actualTimeTakenMinutes'] != null)
                              Text(
                                'Took: ${order['actualTimeTakenMinutes']}m',
                                style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 9),
                              ),
                          ],
                        ),
                    ],
                  ),
                );
              },
            ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  Widget _buildMapViewComponent({required bool isFullScreen}) {
    // Collect coordinates to plot
    final warehouseLat = _activeTripInfo?['warehouse']?['latitude'] as num?;
    final warehouseLng = _activeTripInfo?['warehouse']?['longitude'] as num?;

    // Plot polyline
    final List<LatLng> polylinePoints = [];
    final roadRoute = _activeTripInfo?['trip']?['roadRoute'] as List?;
    if (roadRoute != null) {
      for (var r in roadRoute) {
        final lat = r['latitude'] as num?;
        final lng = r['longitude'] as num?;
        if (lat != null && lng != null) {
          polylinePoints.add(LatLng(lat.toDouble(), lng.toDouble()));
        }
      }
    }

    // Plot markers
    final List<Marker> markers = [];

    // 1. Warehouse marker
    if (warehouseLat != null && warehouseLng != null) {
      markers.add(
        Marker(
          point: LatLng(warehouseLat.toDouble(), warehouseLng.toDouble()),
          width: 38,
          height: 38,
          child: Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.green.withOpacity(0.2),
              border: Border.all(color: Colors.green, width: 2),
            ),
            child: const Icon(Icons.home, color: Colors.green, size: 18),
          ),
        ),
      );
    }

    // 2. Customers stops markers
    final ordersList = _activeTripInfo?['orders'] as List?;
    if (ordersList != null) {
      for (var idx = 0; idx < ordersList.length; idx++) {
        final customer = ordersList[idx]['customer'];
        if (customer != null) {
          final cLat = customer['latitude'] as num?;
          final cLng = customer['longitude'] as num?;
          if (cLat != null && cLng != null) {
            final isHigh = customer['priority'] == 'High';
            final clr = isHigh ? Colors.red : Colors.blue;
            markers.add(
              Marker(
                point: LatLng(cLat.toDouble(), cLng.toDouble()),
                width: 32,
                height: 32,
                child: Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: clr,
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${idx + 1}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11),
                  ),
                ),
              ),
            );
          }
        }
      }
    }

    // 3. Driver smooth Google Maps live location cursor marker
    if (roadRoute != null && roadRoute.isNotEmpty) {
      markers.add(
        Marker(
          point: _animatedPos,
          width: 44,
          height: 44,
          child: Transform.rotate(
            angle: _animatedBearing * math.pi / 180,
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF0F172A),
                border: Border.all(color: const Color(0xFF06B6D4), width: 2.5),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF06B6D4).withOpacity(0.6),
                    blurRadius: 12,
                    spreadRadius: 2,
                  )
                ],
              ),
              child: const Icon(Icons.navigation, color: Color(0xFF06B6D4), size: 22),
            ),
          ),
        ),
      );
    }

    String tileUrl;
    List<String> subdomains;
    if (_mapStyle == 'hybrid' || _mapStyle == 'satellite') {
      tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      subdomains = const [];
    } else if (_mapStyle == 'dark') {
      tileUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
      subdomains = const ['a', 'b', 'c', 'd'];
    } else {
      tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      subdomains = const [];
    }

    return Container(
      decoration: BoxDecoration(
        border: isFullScreen ? null : Border.all(color: const Color(0xFF334155)),
        borderRadius: isFullScreen ? BorderRadius.zero : BorderRadius.circular(12),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: polylinePoints.isNotEmpty
                  ? polylinePoints[0]
                  : (warehouseLat != null && warehouseLng != null
                      ? LatLng(warehouseLat.toDouble(), warehouseLng.toDouble())
                      : const LatLng(13.045, 80.25)),
              initialZoom: 12.5,
            ),
            children: [
              TileLayer(
                urlTemplate: tileUrl,
                subdomains: subdomains,
                userAgentPackageName: 'com.smartroute.driver_app',
              ),
              if (polylinePoints.isNotEmpty)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: polylinePoints,
                      strokeWidth: 3.5,
                      color: const Color(0xFF8B5CF6),
                    ),
                  ],
                ),
              MarkerLayer(markers: markers),
            ],
          ),

          // Top Floating Control Bar (Map Views & Maximize/Minimize Fullscreen Toggle)
          Positioned(
            top: 8,
            left: 8,
            right: 8,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Map View Selector Chips (Road, Hybrid, Dark)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A).withOpacity(0.9),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFF334155)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildMapStyleChip('road', 'Road', Icons.map),
                      _buildMapStyleChip('hybrid', 'Hybrid', Icons.satellite_alt),
                      _buildMapStyleChip('dark', 'Dark', Icons.dark_mode),
                    ],
                  ),
                ),

                // Maximize / Minimize Fullscreen Toggle Button (YouTube-style 100% full screen)
                GestureDetector(
                  onTap: () {
                    setState(() {
                      _isMapFullscreen = !_isMapFullscreen;
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF06B6D4),
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.4),
                          blurRadius: 6,
                        )
                      ],
                    ),
                    child: Icon(
                      isFullScreen ? Icons.fullscreen_exit : Icons.fullscreen,
                      color: Colors.black,
                      size: 22,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Bottom Left Emergency Buttons Overlay (Shown ONLY in Full-Screen YouTube Map View)
          if (isFullScreen)
            Positioned(
              bottom: 12,
              left: 12,
              right: 70,
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A).withOpacity(0.92),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _handleReportRoadblockSOS,
                        icon: const Icon(Icons.whatshot, size: 14),
                        label: const Text('SOS Traffic', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.red.withOpacity(0.2),
                          foregroundColor: Colors.redAccent,
                          side: const BorderSide(color: Colors.redAccent, width: 1.2),
                          minimumSize: const Size.fromHeight(36),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: _handleReportBreakdown,
                        icon: const Icon(Icons.error_outline, size: 14),
                        label: const Text('Breakdown', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.orange.withOpacity(0.2),
                          foregroundColor: Colors.orangeAccent,
                          side: const BorderSide(color: Colors.orangeAccent, width: 1.2),
                          minimumSize: const Size.fromHeight(36),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          padding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          // Bottom Right Control Column (Recenter Target)
          Positioned(
            bottom: 12,
            right: 12,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Recenter Target Position
                if (polylinePoints.isNotEmpty)
                  GestureDetector(
                    onTap: () => _recenterMap(polylinePoints[0]),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B).withOpacity(0.9),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF334155)),
                      ),
                      child: const Icon(Icons.my_location, color: Colors.white, size: 20),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIdleQueueScreen() {
    final filteredQueue = _notificationsQueue.where((n) {
      final notifId = n['orderId'] ?? n['breakdownId'];
      return !_hiddenNotifIds.contains(notifId);
    }).toList();

    if (filteredQueue.isNotEmpty) {
      return ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: filteredQueue.length,
        itemBuilder: (context, idx) {
          final n = filteredQueue[idx];
          final isBreakdown = n['breakdownId'] != null;
          final isAcceptedByOther = n['isAcceptedByOther'] == true;

          final labelColor = isBreakdown ? Colors.red : const Color(0xFF8B5CF6);
          final title = isBreakdown ? '⚠️ RECOVERY ASSIGNMENT' : '📦 NEW ORDER ROUTE';
          final badgeText = n['priorityLabel'] ?? n['priority'] ?? 'Far';

          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              border: Border.all(
                color: isBreakdown ? Colors.red.withOpacity(0.2) : const Color(0xFF8B5CF6).withOpacity(0.2),
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      title,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: labelColor),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: labelColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        badgeText,
                        style: TextStyle(color: labelColor, fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (isBreakdown) ...[
                  Text('Original Driver: ${n['originalDriverName']}', style: const TextStyle(fontSize: 11)),
                  const SizedBox(height: 3),
                  Text('Customer: ${n['customerName']}', style: const TextStyle(fontSize: 11)),
                  const SizedBox(height: 3),
                  Text('Source Depot: ${n['warehouseName']}', style: const TextStyle(fontSize: 11)),
                  const SizedBox(height: 6),
                  const Divider(color: Color(0xFF334155), height: 1),
                  const SizedBox(height: 6),
                  Text('Dist to Breakdown: ${n['distanceToBreakdown']} km', style: const TextStyle(fontSize: 11)),
                  const SizedBox(height: 3),
                  Text('Remaining dist: ${n['remainingDistance']} km', style: const TextStyle(fontSize: 11)),
                  const SizedBox(height: 3),
                  Text('Total dist: ${n['totalDistance']} km', style: const TextStyle(fontSize: 11)),
                ] else ...[
                  Text('Order ID: ${n['orderId']}', style: const TextStyle(fontSize: 11, color: Color(0xFF06B6D4))),
                  const SizedBox(height: 3),
                  Text('Customer: ${n['customerName']}', style: const TextStyle(fontSize: 11)),
                  const SizedBox(height: 3),
                  Text('Source Depot: ${n['warehouseName']}', style: const TextStyle(fontSize: 11)),
                  const SizedBox(height: 3),
                  Text('Weight: ${n['size']} kg (${n['priority']})', style: const TextStyle(fontSize: 11)),
                  const SizedBox(height: 6),
                  const Divider(color: Color(0xFF334155), height: 1),
                  const SizedBox(height: 6),
                  Text('Dist to Depot: ${n['distanceToWarehouse']} km', style: const TextStyle(fontSize: 11)),
                  const SizedBox(height: 3),
                  Text('Trip dist: ${n['deliveryDistance'] ?? n['tripDistance'] ?? n['distanceToCustomer']} km', style: const TextStyle(fontSize: 11)),
                  const SizedBox(height: 3),
                  Text('Total dist: ${n['totalDistance']} km', style: const TextStyle(fontSize: 11)),
                ],
                const SizedBox(height: 12),
                if (isAcceptedByOther)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(8),
                    color: Colors.white.withOpacity(0.05),
                    child: Text(
                      'Claimed by ${n['acceptedByName'] ?? "another driver"}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                  )
                else
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () => _handleRejectRequest(isBreakdown ? n['breakdownId'] : n['orderId']),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.transparent,
                            foregroundColor: Colors.red,
                            side: const BorderSide(color: Colors.red),
                            minimumSize: const Size.fromHeight(32),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                          ),
                          child: const Text('Reject / Ignore', style: TextStyle(fontSize: 11)),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _isLoading
                              ? null
                              : () => isBreakdown
                                  ? _handleAcceptRecovery(n['breakdownId'])
                                  : _handleAcceptOrder(n['orderId']),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF06B6D4),
                            foregroundColor: Colors.black,
                            minimumSize: const Size.fromHeight(32),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                          ),
                          child: const Text('Accept Load', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          );
        },
      );
    }

    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.local_shipping, size: 48, color: Colors.white.withOpacity(0.3)),
          const SizedBox(height: 12),
          const Text(
            'No Active Shifts Scheduled',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32.0),
            child: Text(
              'Waiting for the Administrator back office to assign a quantum-optimized route job.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.4)),
            ),
          ),
        ],
      ),
    );
  }
}
