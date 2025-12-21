/**
 * Face Recognition Attendance System
 * Professional UI for face detection and attendance marking
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// Face Frame Component with Grid
const FaceFrame = ({ isScanning }: { isScanning: boolean }) => {
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const gridOpacity = useRef(new Animated.Value(0.3)).current;

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
            toValue: 1.1,
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
            toValue: 0.8,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(gridOpacity, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [isScanning, scanLineAnim, pulseAnim, gridOpacity]);

  const frameSize = width * 0.75;
  const gridLines = 8;

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, frameSize],
  });

  return (
    <View style={[styles.faceFrame, { width: frameSize, height: frameSize }]}>
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

      {/* Face Silhouette */}
      <View style={styles.faceSilhouette}>
        <View style={styles.faceOval} />
        <View style={styles.eyesContainer}>
          <View style={styles.eye} />
          <View style={styles.eye} />
        </View>
        <View style={styles.nose} />
        <View style={styles.mouth} />
      </View>
    </View>
  );
};

// Status Indicator Component
const StatusIndicator = ({
  status,
  message,
}: {
  status: 'idle' | 'scanning' | 'success' | 'error';
  message: string;
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
    }
  }, [status, dotAnim]);

  const getStatusColor = () => {
    switch (status) {
      case 'scanning':
        return '#00FF88';
      case 'success':
        return '#00FF88';
      case 'error':
        return '#FF4444';
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
      <Text style={[styles.statusText, { color: getStatusColor() }]}>
        {message}
      </Text>
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
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState<
    'idle' | 'scanning' | 'success' | 'error'
  >('idle');
  const [statusMessage, setStatusMessage] = useState('Ready to scan');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleMarkAttendance = () => {
    if (isScanning) {
      // Cancel scanning
      setIsScanning(false);
      setStatus('idle');
      setStatusMessage('Ready to scan');
      return;
    }

    // Start scanning
    setIsScanning(true);
    setStatus('scanning');
    setStatusMessage('Detecting face...');

    // Simulate face detection process
    setTimeout(() => {
      setStatusMessage('Analyzing features...');
    }, 1500);

    setTimeout(() => {
      setStatusMessage('Verifying identity...');
    }, 3000);

    setTimeout(() => {
      setIsScanning(false);
      setStatus('success');
      setStatusMessage('Attendance marked successfully!');

      // Reset after success
      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('Ready to scan');
      }, 3000);
    }, 4500);
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
      {/* Background Gradient Effect */}
      <View style={styles.backgroundGradient} />
      <View style={styles.backgroundGlow} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>FaceAttend</Text>
        <Text style={styles.subtitle}>Biometric Attendance System</Text>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Face Detection Frame */}
        <View style={styles.frameContainer}>
          <FaceFrame isScanning={isScanning} />
        </View>

        {/* Status */}
        <StatusIndicator status={status} message={statusMessage} />

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
              <Text style={styles.buttonText}>
                {status === 'success'
                  ? 'Marked!'
                  : isScanning
                  ? 'Cancel'
                  : 'Mark Attendance'}
              </Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Info Text */}
        <Text style={styles.infoText}>
          Position your face within the frame for accurate detection
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
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.5,
    backgroundColor: '#0A0A0F',
    opacity: 0.9,
  },
  backgroundGlow: {
    position: 'absolute',
    top: height * 0.15,
    left: width * 0.1,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: '#00FF88',
    opacity: 0.03,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#00FF88',
    marginTop: 4,
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  frameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  faceFrame: {
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 255, 136, 0.02)',
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
    width: 40,
    height: 40,
  },
  topLeft: {
    top: -2,
    left: -2,
  },
  topRight: {
    top: -2,
    right: -2,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
  },
  cornerLine: {
    position: 'absolute',
    backgroundColor: '#00FF88',
  },
  cornerTop: {
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
  },
  cornerBottom: {
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
  },
  cornerLeft: {
    top: 0,
    left: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
  },
  cornerRight: {
    top: 0,
    right: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#00FF88',
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },
  faceSilhouette: {
    position: 'absolute',
    top: '15%',
    left: '20%',
    right: '20%',
    bottom: '15%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOval: {
    width: '85%',
    height: '100%',
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 136, 0.3)',
    borderRadius: 999,
    position: 'absolute',
  },
  eyesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '50%',
    position: 'absolute',
    top: '30%',
  },
  eye: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 136, 0.4)',
  },
  nose: {
    width: 8,
    height: 20,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 136, 0.3)',
    borderRadius: 4,
    position: 'absolute',
    top: '45%',
  },
  mouth: {
    width: 30,
    height: 8,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 136, 0.3)',
    borderRadius: 10,
    position: 'absolute',
    top: '70%',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 30,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  timeContainer: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 4,
  },
  timeDisplay: {
    alignItems: 'center',
  },
  time: {
    fontSize: 28,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  date: {
    fontSize: 14,
    color: '#888888',
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 30,
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#00FF88',
    paddingVertical: 18,
    paddingHorizontal: 50,
    borderRadius: 60,
    shadowColor: '#00FF88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
    minWidth: 250,
  },
  actionButtonScanning: {
    backgroundColor: '#333333',
    shadowColor: '#333333',
  },
  actionButtonSuccess: {
    backgroundColor: '#00FF88',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#0A0A0F',
    letterSpacing: 0.5,
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
    marginTop: 20,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
});

export default App;
