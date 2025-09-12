import React, { useState, useEffect, useRef } from 'react';
import Quagga from '@ericblade/quagga2';
import { XMarkIcon, CameraIcon } from '@heroicons/react/24/outline';

const AdvancedBarcodeScanner = ({ onScan, onClose, isOpen }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const scannerRef = useRef(null);
  const videoRef = useRef(null);

  // Get available cameras
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        
        // Prefer back camera on mobile devices
        const backCamera = videoDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('rear')
        );
        setSelectedCamera(backCamera || videoDevices[0]);
      } catch (err) {
        console.error('Error getting cameras:', err);
        setError('Unable to access camera devices');
      }
    };

    if (isOpen) {
      getCameras();
    }
  }, [isOpen]);

  // Initialize QuaggaJS scanner
  const initializeScanner = () => {
    if (!selectedCamera || !scannerRef.current) return;

    const config = {
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: scannerRef.current,
        constraints: {
          width: { min: 640 },
          height: { min: 480 },
          deviceId: selectedCamera.deviceId,
          facingMode: 'environment' // Prefer back camera
        }
      },
      locator: {
        patchSize: "medium",
        halfSample: true
      },
      numOfWorkers: 2,
      frequency: 10,
      decoder: {
        readers: [
          "code_128_reader",
          "ean_reader",
          "ean_8_reader",
          "code_39_reader",
          "code_39_vin_reader",
          "codabar_reader",
          "upc_reader",
          "upc_e_reader",
          "i2of5_reader",
          "2of5_reader",
          "code_93_reader"
        ],
        debug: {
          drawBoundingBox: true,
          showFrequency: true,
          drawScanline: true,
          showPattern: true
        }
      },
      locate: true
    };

    Quagga.init(config, (err) => {
      if (err) {
        console.error('QuaggaJS initialization error:', err);
        setError('Failed to initialize camera scanner');
        return;
      }
      
      console.log('QuaggaJS initialized successfully');
      Quagga.start();
      setIsScanning(true);
      setError(null);
    });

    // Handle successful barcode detection
    Quagga.onDetected((result) => {
      const code = result.codeResult.code;
      console.log('Barcode detected:', code);
      
      // Stop scanning and return result
      stopScanner();
      onScan(code);
    });

    // Handle processing errors
    Quagga.onProcessed((result) => {
      if (result && result.codeResult) {
        // Draw detection box
        const drawingCtx = Quagga.canvas.ctx.overlay;
        const drawingCanvas = Quagga.canvas.dom.overlay;
        
        if (result.boxes) {
          drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
          result.boxes.filter(box => box !== result.box).forEach(box => {
            Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});
          });
        }
        
        if (result.box) {
          Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "#00F", lineWidth: 2});
        }
        
        if (result.codeResult && result.codeResult.code) {
          Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {color: 'red', lineWidth: 3});
        }
      }
    });
  };

  // Stop scanner
  const stopScanner = () => {
    if (isScanning) {
      Quagga.stop();
      setIsScanning(false);
    }
  };

  // Start scanning when component opens
  useEffect(() => {
    if (isOpen && selectedCamera && !isScanning) {
      initializeScanner();
    }
    
    return () => {
      stopScanner();
    };
  }, [isOpen, selectedCamera]);

  // Handle camera change
  const handleCameraChange = (cameraId) => {
    const camera = cameras.find(c => c.deviceId === cameraId);
    setSelectedCamera(camera);
    
    if (isScanning) {
      stopScanner();
      setTimeout(() => {
        initializeScanner();
      }, 100);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-start justify-center z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto mt-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Scan Barcode</h2>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Camera Selection */}
        {cameras.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Camera:
            </label>
            <select
              value={selectedCamera?.deviceId || ''}
              onChange={(e) => handleCameraChange(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {cameras.map((camera) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `Camera ${camera.deviceId.slice(0, 8)}...`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Scanner Container */}
        <div className="relative">
          <div 
            ref={scannerRef}
            className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden relative"
            style={{ minHeight: '320px' }}
          >
            {!isScanning && !error && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <CameraIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Initializing camera...</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Scanning Overlay */}
          {isScanning && (
            <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-sm">
              📷 Scanning...
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-4 text-sm text-gray-600">
          <p className="mb-2">📱 <strong>Instructions:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Point your camera at a barcode</li>
            <li>Ensure good lighting and steady hands</li>
            <li>The barcode will be detected automatically</li>
            <li>Supported formats: EAN, UPC, Code 128, Code 39, and more</li>
          </ul>
        </div>

        {/* Manual Input Fallback */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Can't scan? Enter barcode manually:</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter barcode number"
              className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  stopScanner();
                  onScan(e.target.value.trim());
                }
              }}
            />
            <button
              onClick={(e) => {
                const input = e.target.previousElementSibling;
                if (input.value.trim()) {
                  stopScanner();
                  onScan(input.value.trim());
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedBarcodeScanner;