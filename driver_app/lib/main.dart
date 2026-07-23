import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/login_screen.dart';
import 'screens/driver_dashboard.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SharedPreferences prefs = await SharedPreferences.getInstance();
  String? token = prefs.getString('token');
  String? userJson = prefs.getString('user');
  const String defaultProductionUrl = 'https://smartroute-backend-qp2k.onrender.com';
  String serverUrl = prefs.getString('server_url') ?? defaultProductionUrl;

  // Auto-migrate legacy local network IP addresses to the fixed production Render URL
  if (serverUrl.contains('192.168.') || serverUrl.contains('localhost') || serverUrl.contains('127.0.0.1')) {
    serverUrl = defaultProductionUrl;
    await prefs.setString('server_url', defaultProductionUrl);
  }

  runApp(DriverApp(
    initialToken: token,
    initialUserJson: userJson,
    initialServerUrl: serverUrl,
  ));
}

class DriverApp extends StatelessWidget {
  final String? initialToken;
  final String? initialUserJson;
  final String? initialServerUrl;

  const DriverApp({
    super.key,
    this.initialToken,
    this.initialUserJson,
    this.initialServerUrl,
  });

  @override
  Widget build(BuildContext context) {
    bool hasAuth = initialToken != null && initialUserJson != null;

    return MaterialApp(
      title: 'SmartRoute Driver',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A), // Slate 900
        primaryColor: const Color(0xFF06B6D4), // Cyan 500
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF06B6D4),
          secondary: Color(0xFF8B5CF6), // Purple 500
          surface: Color(0xFF1E293B), // Slate 800
          error: Color(0xFFEF4444),
        ),
        textTheme: const TextTheme(
          displayLarge: TextStyle(fontFamily: 'Outfit', fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
          titleLarge: TextStyle(fontFamily: 'Outfit', fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
          bodyLarge: TextStyle(fontFamily: 'Inter', fontSize: 14, color: Colors.white),
          bodyMedium: TextStyle(fontFamily: 'Inter', fontSize: 12, color: Color(0xFF9CA3AF)), // Slate 400
        ),
        cardTheme: const CardThemeData(
          color: Color(0xFF1E293B),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.all(Radius.circular(16)),
            side: BorderSide(color: Color(0xFF334155), width: 1),
          ),
          elevation: 0,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFF1E293B),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFF334155)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFF334155)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFF06B6D4), width: 1.5),
          ),
        ),
      ),
      home: hasAuth
          ? DriverDashboard(
              token: initialToken!,
              userJson: initialUserJson!,
              serverUrl: initialServerUrl!,
            )
          : LoginScreen(initialServerUrl: initialServerUrl!),
    );
  }
}
