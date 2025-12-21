/**
 * Face Recognition Attendance System
 * Professional UI with WebSocket streaming for face detection
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
  Image,
  Alert,
  Platform,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import RNFS from 'react-native-fs';

const { width, height } = Dimensions.get('window');
const WEBSOCKET_URL = 'ws://62.84.186.207/api/v1/ws/attendance';
const FRAME_INTERVAL = 200; // Send frame every 200ms

// Face Frame Component with Grid Overlay
const FaceFrameOverlay = ({
  isScanning,
  pulseAnim,
  gridOpacity,
  scanLineAnim,
}: {
  isScanning: boolean;
  pulseAnim: Animated.Value;
  gridOpacity: Animated.Value;
  scanLineAnim: Animated.Value;
}) => {
  const frameSize = width * 0.85;
  const gridLines = 8;

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, frameSize],
  });

  return (
    <View
      style={[styles.faceFrameOverlay, { width: frameSize, height: frameSize }]}
      pointerEvents="none"
    >
      {/* Grid Lines */}
      <Animated.View style={[styles.gridContainer, { opacity: gridOpacity }]}>
        {/* Vertical lines */}
        {[...Array(gridLines + 1)].map((_, i) => (
          <View
            key={`v-${i}`}
            style={[
              styles.gridLine,
              styles.verticalLine,
              { left: `${(i / gridLines) * 100}%` },
            ]}
          />
        ))}
        {/* Horizontal lines */}
        {[...Array(gridLines + 1)].map((_, i) => (
          <View
            key={`h-${i}`}
            style={[
              styles.gridLine,
              styles.horizontalLine,
              { top: `${(i / gridLines) * 100}%` },
            ]}
          />
        ))}
      </Animated.View>

      {/* Corner Brackets */}
      <Animated.View
        style={[
          styles.corner,
          styles.topLeft,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <View style={[styles.cornerLine, styles.cornerTop]} />
        <View style={[styles.cornerLine, styles.cornerLeft]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.corner,
          styles.topRight,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <View style={[styles.cornerLine, styles.cornerTop]} />
        <View style={[styles.cornerLine, styles.cornerRight]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.corner,
          styles.bottomLeft,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <View style={[styles.cornerLine, styles.cornerBottom]} />
        <View style={[styles.cornerLine, styles.cornerLeft]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.corner,
          styles.bottomRight,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <View style={[styles.cornerLine, styles.cornerBottom]} />
        <View style={[styles.cornerLine, styles.cornerRight]} />
      </Animated.View>

      {/* Scan Line */}
      {isScanning && (
        <Animated.View
          style={[
            styles.scanLine,
            {
              transform: [{ translateY: scanLineTranslate }],
            },
          ]}
        />
      )}
    </View>
  );
};

// Status Indicator Component
const StatusIndicator = ({
  status,
  message,
  userName,
  score,
}: {
  status: 'idle' | 'scanning' | 'success' | 'error' | 'no_face';
  message: string;
  userName?: string;
  score?: number;
}) => {
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'scanning') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      dotAnim.setValue(1);
    }
  }, [status, dotAnim]);

  const getStatusColor = () => {
    switch (status) {
      case 'scanning':
        return '#00FF88';
      case 'success':
        return '#00FF88';
      case 'error':
      case 'no_face':
        return '#FF6B6B';
      default:
        return '#666666';
    }
  };

  return (
    <View style={styles.statusContainer}>
      <Animated.View
        style={[
          styles.statusDot,
          {
            backgroundColor: getStatusColor(),
            opacity: status === 'scanning' ? dotAnim : 1,
          },
        ]}
      />
      <View style={styles.statusTextContainer}>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {message}
        </Text>
        {userName && (
          <Text style={styles.userNameText}>
            Welcome, {userName} {score ? `(${(score * 100).toFixed(1)}%)` : ''}
          </Text>
        )}
      </View>
    </View>
  );
};

// Camera Permission Screen
const PermissionScreen = ({
  onRequestPermission,
}: {
  onRequestPermission: () => void;
}) => {
  return (
    <View style={styles.permissionContainer}>
      <View style={styles.permissionIcon}>
        <Text style={styles.permissionIconText}>📷</Text>
      </View>
      <Text style={styles.permissionTitle}>Camera Access Required</Text>
      <Text style={styles.permissionSubtitle}>
        We need camera access to scan your face for attendance verification
      </Text>
      <TouchableOpacity
        style={styles.permissionButton}
        onPress={onRequestPermission}
      >
        <Text style={styles.permissionButtonText}>Grant Permission</Text>
      </TouchableOpacity>
    </View>
  );
};

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const cameraRef = useRef<Camera>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState<
    'idle' | 'scanning' | 'success' | 'error' | 'no_face'
  >('idle');
  const [statusMessage, setStatusMessage] = useState('Ready to scan');
  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);
  const [matchedUser, setMatchedUser] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const gridOpacity = useRef(new Animated.Value(0.3)).current;

  // Initialize fade animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Scanning animations
  useEffect(() => {
    if (isScanning) {
      // Scanning line animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ).start();

      // Pulse animation for corners
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();

      // Grid glow animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(gridOpacity, {
            toValue: 0.6,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(gridOpacity, {
            toValue: 0.2,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      scanLineAnim.setValue(0);
      pulseAnim.setValue(1);
      gridOpacity.setValue(0.3);
    }
  }, [isScanning, scanLineAnim, pulseAnim, gridOpacity]);

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('🔌 [WS] Already connected, skipping...');
      return;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔌 [WS] Connecting to:', WEBSOCKET_URL);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const ws = new WebSocket(WEBSOCKET_URL);

    ws.onopen = () => {
      console.log('✅ [WS] Connected successfully!');
      console.log('📡 [WS] Ready to stream frames');
      setWsConnected(true);
      setStatusMessage('Connected - Streaming...');
    };

    let frameCount = 0;
    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        const timestamp = new Date().toLocaleTimeString();

        if (data.status === 'frame' && data.image) {
          frameCount++;
          // Log every 5th frame to avoid spam
          if (frameCount % 5 === 0) {
            console.log(
              `📷 [WS] Frame #${frameCount} received at ${timestamp}`,
            );
          }
          setAnnotatedImage('data:image/jpeg;base64,' + data.image);
          if (status !== 'success') {
            setStatus('scanning');
            setStatusMessage('Scanning face...');
          }
        } else if (data.status === 'matched') {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('✅ [WS] FACE MATCHED!');
          console.log('👤 [WS] User ID:', data.userId);
          console.log('📊 [WS] Score:', data.score);
          console.log('💬 [WS] Message:', data.message);
          console.log('⏰ [WS] Timestamp:', data.timestamp);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          setStatus('success');
          setStatusMessage(data.message || 'Attendance Marked!');
          setMatchedUser(data.userId || 'User');
          setMatchScore(data.score);

          if (frameIntervalRef.current) {
            console.log('🛑 [WS] Stopping frame streaming...');
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
          }

          setTimeout(() => {
            console.log('🔄 [UI] Resetting UI after match...');
            setIsScanning(false);
            setAnnotatedImage(null);
            setTimeout(() => {
              setStatus('idle');
              setStatusMessage('Ready to scan');
              setMatchedUser(null);
              setMatchScore(null);
              console.log('✨ [UI] Ready for next scan');
            }, 2000);
          }, 3000);
        } else if (data.status === 'unmatched') {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('❌ [WS] FACE NOT MATCHED');
          console.log('💬 [WS] Message:', data.message);
          console.log('⏰ [WS] Timestamp:', data.timestamp);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          setStatus('error');
          setStatusMessage(data.message || 'Face not recognized');
          setMatchedUser(null);
          setMatchScore(null);

          if (frameIntervalRef.current) {
            console.log('🛑 [WS] Stopping frame streaming...');
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
          }

          setTimeout(() => {
            console.log('🔄 [UI] Resetting UI after unmatched...');
            setIsScanning(false);
            setAnnotatedImage(null);
            setTimeout(() => {
              setStatus('idle');
              setStatusMessage('Ready to scan');
              console.log('✨ [UI] Ready for next scan');
            }, 2000);
          }, 3000);
        } else if (data.status === 'timeout') {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('⏱️ [WS] SESSION TIMEOUT');
          console.log('💬 [WS] Message:', data.message);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          setStatus('error');
          setStatusMessage(data.message || 'Session timed out');

          if (frameIntervalRef.current) {
            console.log('🛑 [WS] Stopping frame streaming...');
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
          }

          setTimeout(() => {
            console.log('🔄 [UI] Resetting UI after timeout...');
            setIsScanning(false);
            setAnnotatedImage(null);
            setTimeout(() => {
              setStatus('idle');
              setStatusMessage('Ready to scan');
              console.log('✨ [UI] Ready for next scan');
            }, 2000);
          }, 2000);
        } else if (data.status === 'no_face') {
          console.log('👤 [WS] No face detected in frame');
          setStatus('no_face');
          setStatusMessage('Position your face in frame');
        } else if (data.status === 'error') {
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('⚠️ [WS] SERVER ERROR');
          console.log('💬 [WS] Message:', data.message);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          setStatus('error');
          setStatusMessage(data.message || 'Server error');
        } else {
          console.log('❓ [WS] Unknown status received:', data.status);
          console.log('📦 [WS] Full data:', JSON.stringify(data));
        }
      } catch (error) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚨 [WS] Error parsing message!');
        console.log('📦 [WS] Raw event data:', event.data?.substring(0, 200));
        console.log('❌ [WS] Error:', error);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      }
    };

    ws.onerror = error => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚨 [WS] CONNECTION ERROR!');
      console.log('❌ [WS] Error details:', error);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      setWsConnected(false);
      setStatus('error');
      setStatusMessage('Connection error');
    };

    ws.onclose = event => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔌 [WS] Connection closed');
      console.log('📊 [WS] Total frames received:', frameCount);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      setWsConnected(false);
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    };

    wsRef.current = ws;
  }, [status]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    console.log('🔌 [WS] Disconnecting WebSocket...');
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      console.log('✅ [WS] WebSocket disconnected');
    } else {
      console.log('ℹ️ [WS] No active connection to disconnect');
    }
    setWsConnected(false);
  }, []);

  // Capture and send frame
  let sendCount = 0;
  const captureAndSendFrame = useCallback(async () => {
    if (!cameraRef.current) {
      console.log('⚠️ [CAMERA] Camera ref not available');
      return;
    }

    if (!wsRef.current) {
      console.log('⚠️ [WS] WebSocket ref not available');
      return;
    }

    if (wsRef.current.readyState !== WebSocket.OPEN) {
      console.log(
        '⚠️ [WS] WebSocket not open, state:',
        wsRef.current.readyState,
      );
      return;
    }

    try {
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });

      sendCount++;
      if (sendCount % 5 === 0) {
        console.log(`📸 [CAMERA] Captured photo #${sendCount}:`, photo.path);
      }

      // Read the file as base64 using react-native-fs (fetch doesn't work with file:// on Android)
      const base64Image = await RNFS.readFile(photo.path, 'base64');
      const base64data = `data:image/jpeg;base64,${base64Image}`;

      if (wsRef.current?.readyState === WebSocket.OPEN) {
        if (sendCount % 5 === 0) {
          console.log(
            `📤 [WS] Sending frame #${sendCount}, size: ${(
              base64data.length / 1024
            ).toFixed(1)}KB`,
          );
        }
        wsRef.current.send(base64data);
      } else {
        console.log('⚠️ [WS] Cannot send - connection not open');
      }

      // Clean up the temp file to save memory
      try {
        await RNFS.unlink(photo.path);
      } catch {
        // Ignore cleanup errors
      }
    } catch (error) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚨 [CAMERA] Error capturing frame!');
      console.log('❌ [CAMERA] Error:', error);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }, []);

  // Start frame streaming
  const startFrameStreaming = useCallback(() => {
    console.log('▶️ [STREAM] Starting frame streaming...');
    console.log('⏱️ [STREAM] Interval:', FRAME_INTERVAL, 'ms');

    if (frameIntervalRef.current) {
      console.log('🔄 [STREAM] Clearing existing interval');
      clearInterval(frameIntervalRef.current);
    }

    frameIntervalRef.current = setInterval(() => {
      captureAndSendFrame();
    }, FRAME_INTERVAL);

    console.log('✅ [STREAM] Frame streaming started');
  }, [captureAndSendFrame]);

  // Stop frame streaming
  const stopFrameStreaming = useCallback(() => {
    console.log('⏹️ [STREAM] Stopping frame streaming...');
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
      console.log('✅ [STREAM] Frame streaming stopped');
    } else {
      console.log('ℹ️ [STREAM] No active streaming to stop');
    }
  }, []);

  // Start scanning
  const startScanning = useCallback(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 [APP] STARTING FACE SCAN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    setIsScanning(true);
    setStatus('scanning');
    setStatusMessage('Connecting...');
    setAnnotatedImage(null);
    setMatchedUser(null);
    setMatchScore(null);

    console.log('🔌 [APP] Initiating WebSocket connection...');
    connectWebSocket();

    // Start streaming frames after a short delay
    console.log('⏳ [APP] Waiting 500ms before starting frame stream...');
    setTimeout(() => {
      console.log('📹 [APP] Starting frame capture & stream...');
      startFrameStreaming();
    }, 500);
  }, [connectWebSocket, startFrameStreaming]);

  // Stop scanning
  const stopScanning = useCallback(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛑 [APP] STOPPING FACE SCAN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    setIsScanning(false);
    stopFrameStreaming();
    disconnectWebSocket();
    setAnnotatedImage(null);

    // Reset status after a delay
    setTimeout(() => {
      setStatus('idle');
      setStatusMessage('Ready to scan');
      setMatchedUser(null);
      setMatchScore(null);
      console.log('✨ [APP] Scan stopped, ready for next');
    }, 500);
  }, [stopFrameStreaming, disconnectWebSocket]);

  // Handle mark attendance button
  const handleMarkAttendance = () => {
    console.log('👆 [BUTTON] Mark Attendance pressed');
    console.log('📊 [BUTTON] Current state - isScanning:', isScanning);

    if (isScanning) {
      console.log('🔄 [BUTTON] Action: Stopping scan');
      stopScanning();
    } else {
      console.log('🔄 [BUTTON] Action: Starting scan');
      startScanning();
    }
  };

  const handlePressIn = () => {
    Animated.spring(buttonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(buttonScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFrameStreaming();
      disconnectWebSocket();
    };
  }, [stopFrameStreaming, disconnectWebSocket]);

  // Request camera permission
  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (!result) {
      Alert.alert(
        'Permission Denied',
        'Camera permission is required for face recognition.',
      );
    }
  };

  // Show permission screen if no permission
  if (!hasPermission) {
    return (
      <Animated.View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            opacity: fadeAnim,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>FaceAttend</Text>
          <Text style={styles.subtitle}>Biometric Attendance System</Text>
        </View>
        <PermissionScreen onRequestPermission={handleRequestPermission} />
      </Animated.View>
    );
  }

  // Show error if no camera device
  if (!device) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>No front camera found</Text>
      </View>
    );
  }

  const frameSize = width * 0.85;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          opacity: fadeAnim,
        },
      ]}
    >
      {/* Background */}
      <View style={styles.backgroundGradient} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>FaceAttend</Text>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>Biometric Attendance System</Text>
          <View
            style={[
              styles.connectionDot,
              { backgroundColor: wsConnected ? '#00FF88' : '#666666' },
            ]}
          />
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Camera / Face Detection Frame */}
        <View
          style={[
            styles.cameraContainer,
            { width: frameSize, height: frameSize },
          ]}
        >
          {/* Live Camera Preview */}
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
          />

          {/* Annotated Image Overlay (from WebSocket) */}
          {annotatedImage && isScanning && (
            <Image
              source={{ uri: annotatedImage }}
              style={styles.annotatedImage}
              resizeMode="cover"
            />
          )}

          {/* Grid Overlay */}
          <FaceFrameOverlay
            isScanning={isScanning}
            pulseAnim={pulseAnim}
            gridOpacity={gridOpacity}
            scanLineAnim={scanLineAnim}
          />
        </View>

        {/* Status */}
        <StatusIndicator
          status={status}
          message={statusMessage}
          userName={matchedUser || undefined}
          score={matchScore || undefined}
        />

        {/* Time Display */}
        <View style={styles.timeContainer}>
          <Text style={styles.timeLabel}>Current Time</Text>
          <TimeDisplay />
        </View>
      </View>

      {/* Action Button */}
      <View style={styles.footer}>
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              isScanning && styles.actionButtonScanning,
              status === 'success' && styles.actionButtonSuccess,
            ]}
            onPress={handleMarkAttendance}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.9}
          >
            <View style={styles.buttonInner}>
              {status === 'success' ? (
                <Text style={styles.checkmark}>✓</Text>
              ) : (
                <View style={styles.buttonIconContainer}>
                  <View
                    style={[
                      styles.faceIcon,
                      isScanning && styles.faceIconScanning,
                    ]}
                  />
                </View>
              )}
              <Text
                style={[
                  styles.buttonText,
                  isScanning && styles.buttonTextScanning,
                ]}
              >
                {status === 'success'
                  ? 'Marked!'
                  : isScanning
                  ? 'Stop Scanning'
                  : 'Mark Attendance'}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Info Text */}
        <Text style={styles.infoText}>
          {isScanning
            ? 'Position your face within the frame'
            : 'Tap the button to start face recognition'}
        </Text>
      </View>
    </Animated.View>
  );
}

// Time Display Component
const TimeDisplay = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <View style={styles.timeDisplay}>
      <Text style={styles.time}>{formatTime(time)}</Text>
      <Text style={styles.date}>{formatDate(time)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0A0A0F',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    color: '#00FF88',
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 10,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cameraContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1A1A1F',
    marginBottom: 20,
  },
  annotatedImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  faceFrameOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  gridContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#00FF88',
  },
  verticalLine: {
    width: 1,
    height: '100%',
    opacity: 0.15,
  },
  horizontalLine: {
    height: 1,
    width: '100%',
    opacity: 0.15,
  },
  corner: {
    position: 'absolute',
    width: 50,
    height: 50,
  },
  topLeft: {
    top: 0,
    left: 0,
  },
  topRight: {
    top: 0,
    right: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
  },
  cornerLine: {
    position: 'absolute',
    backgroundColor: '#00FF88',
  },
  cornerTop: {
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
  },
  cornerBottom: {
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
  },
  cornerLeft: {
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
  },
  cornerRight: {
    top: 0,
    right: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#00FF88',
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
    elevation: 5,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 30,
    minWidth: 200,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  userNameText: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  timeContainer: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 11,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  timeDisplay: {
    alignItems: 'center',
  },
  time: {
    fontSize: 24,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  date: {
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#00FF88',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 60,
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
    minWidth: 220,
  },
  actionButtonScanning: {
    backgroundColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
  },
  actionButtonSuccess: {
    backgroundColor: '#00FF88',
    shadowColor: '#00FF88',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIconContainer: {
    marginRight: 12,
  },
  faceIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0A0A0F',
  },
  faceIconScanning: {
    borderColor: '#FFFFFF',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A0A0F',
    letterSpacing: 0.5,
  },
  buttonTextScanning: {
    color: '#FFFFFF',
  },
  checkmark: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0A0A0F',
    marginRight: 10,
  },
  infoText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 16,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  // Permission Screen Styles
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  permissionIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 255, 136, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  permissionIconText: {
    fontSize: 48,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionSubtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#00FF88',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A0A0F',
  },
});

export default App;
