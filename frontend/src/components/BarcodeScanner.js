import React, { useState, useRef, useCallback, useEffect } from 'react';
import { barcodesAPI, settingsAPI } from '../services/api';
import {
  QrCodeIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const BarcodeScanner = ({ onScan, onClose }) => {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await settingsAPI.getSettings();
        setSettings(response.data.settings || {});
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };
    fetchSettings();
  }, []);

  const startScanning = useCallback(async () => {
    try {
      setScanning(true);
      setError('');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Camera access denied or not available');
      setScanning(false);
    }
  }, []);

  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    
    try {
      const response = await barcodesAPI.lookup(manualCode);
      const item = response.data.item;
      
      if (item) {
        setResult(item);
        onScan?.(item);
      } else {
        setError('No item found with this code');
      }
    } catch (err) {
      setError('Error looking up barcode');
    }
  };

  const handleClose = () => {
    stopScanning();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Barcode / QR Code Scanner
          </h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 mb-4">
            {!scanning ? (
              <div className="text-center py-8">
                <QrCodeIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Click to start camera scanning
                </p>
                <button
                  onClick={startScanning}
                  className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
                >
                  Start Camera
                </button>
              </div>
            ) : (
              <div className="relative">
                <video ref={videoRef} autoPlay playsInline className="w-full h-64 object-cover rounded-lg" />
                <button
                  onClick={stopScanning}
                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
              {error}
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
            Or enter code manually:
          </h4>
          
          <form onSubmit={handleManualSubmit} className="flex space-x-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter barcode, QR code, or SKU"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
            />
            <button type="submit" className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md">
              Lookup
            </button>
          </form>
        </div>

        {result && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <h4 className="text-sm font-medium text-green-800 mb-2">Item Found:</h4>
            <div className="text-sm text-green-700">
              <p><strong>Name:</strong> {result.item_name}</p>
              <p><strong>SKU:</strong> {result.sku}</p>
              <p><strong>Price:</strong> {settings?.currency || 'LKR'} {result.sell_price?.toFixed(2)}</p>
              <p><strong>Stock:</strong> {result.quantity} units</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScanner;