import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera as CameraIcon, RefreshCw, Shirt } from 'lucide-react';
import { Pose, POSE_CONNECTIONS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

const TOP_OPTIONS = [
  { id: 'tshirt1', name: 'Classic White T', image: '/clothing/tshirt1.svg' },
  { id: 'tshirt2', name: 'Graphic Black T', image: '/clothing/tshirt2.svg' },
  { id: 'hoodie1', name: 'Blue Hoodie', image: '/clothing/hoodie1.svg' },
  { id: 'jacket1', name: 'Leather Jacket', image: '/clothing/jacket1.svg' },
];

const BOTTOM_OPTIONS = [
  { id: 'jeans1', name: 'Blue Jeans', image: '/clothing/jeans1.svg' },
  { id: 'sweats1', name: 'Grey Sweats', image: '/clothing/sweatpants1.svg' },
  { id: 'none', name: 'No Pants', image: null }, // Option to just wear top
];

// Helper function to auto-crop transparent space from around an image
function cropToVisibleCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const alpha = data[(y * canvas.width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // If the image is completely blank, return original
  if (minX > maxX || minY > maxY) return canvas;

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = width;
  croppedCanvas.height = height;
  const croppedCtx = croppedCanvas.getContext('2d');

  croppedCtx.putImageData(ctx.getImageData(minX, minY, width, height), 0, 0);
  return croppedCanvas;
}

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  const [activeTab, setActiveTab] = useState('tops'); // 'tops' or 'bottoms'
  const [selectedTop, setSelectedTop] = useState(TOP_OPTIONS[0]);
  const [selectedBottom, setSelectedBottom] = useState(BOTTOM_OPTIONS[0]);

  const [isModelLoading, setIsModelLoading] = useState(true);
  const [poseEstimator, setPoseEstimator] = useState(null);

  // Create image objects for drawing on the canvas
  const topImgRef = useRef(new window.Image());
  const bottomImgRef = useRef(new window.Image());

  // Update the image source whenever selection changes
  useEffect(() => {
    if (selectedTop && selectedTop.image) {
      topImgRef.current.src = selectedTop.image;
    }
  }, [selectedTop]);

  useEffect(() => {
    if (selectedBottom && selectedBottom.image) {
      bottomImgRef.current.src = selectedBottom.image;
    }
  }, [selectedBottom]);

  const handleTopUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        // Create an offscreen canvas to process the image pixels
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Get the pixel data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Determine background color (assume top-left pixel is background)
        const bgR = data[0];
        const bgG = data[1];
        const bgB = data[2];

        // Tolerance for considering a pixel "background" (0-255)
        // High tolerance handles JPEG compression artifacts and slight gradients in white backgrounds
        const tolerance = 40;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Check if pixel is pure/near white (common in product photos) OR matches the top-left background color
          const isWhite = r > 240 && g > 240 && b > 240;
          const isBgColor = Math.abs(r - bgR) < tolerance &&
            Math.abs(g - bgG) < tolerance &&
            Math.abs(b - bgB) < tolerance;

          if (isWhite || isBgColor) {
            data[i + 3] = 0; // Set Alpha to 0 (Transparent)
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // Crop the canvas to the tight bounding box of the shirt
        const croppedCanvas = cropToVisibleCanvas(canvas);

        // Convert the newly transparent, cropped canvas back to a Data URL
        const transparentImageUrl = croppedCanvas.toDataURL('image/png');

        const customTop = {
          id: 'custom-top-' + Date.now(),
          name: 'Custom Upload',
          image: transparentImageUrl
        };
        setSelectedTop(customTop);
      };
      // Load the uploaded file into the Image object to trigger onload
      img.src = URL.createObjectURL(file);
    }
  };

  const handleBottomUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        // Create an offscreen canvas to process the image pixels
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Get the pixel data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Determine background color (assume top-left pixel is background)
        const bgR = data[0];
        const bgG = data[1];
        const bgB = data[2];

        // Tolerance for considering a pixel "background" (0-255)
        const tolerance = 40;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Check if pixel is pure/near white OR matches the top-left background color
          const isWhite = r > 240 && g > 240 && b > 240;
          const isBgColor = Math.abs(r - bgR) < tolerance &&
            Math.abs(g - bgG) < tolerance &&
            Math.abs(b - bgB) < tolerance;

          if (isWhite || isBgColor) {
            data[i + 3] = 0; // Set Alpha to 0 (Transparent)
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // Crop the canvas to the tight bounding box of the pants
        const croppedCanvas = cropToVisibleCanvas(canvas);

        // Convert the newly transparent, cropped canvas back to a Data URL
        const transparentImageUrl = croppedCanvas.toDataURL('image/png');

        const customBottom = {
          id: 'custom-bottom-' + Date.now(),
          name: 'Custom Upload',
          image: transparentImageUrl
        };
        setSelectedBottom(customBottom);
      };
      // Load the uploaded file into the Image object to trigger onload
      img.src = URL.createObjectURL(file);
    }
  };

  // MediaPipe Initialization
  useEffect(() => {
    let camera = null;

    // Initialize MediaPipe Pose
    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults((results) => {
      setIsModelLoading(false);

      // Draw landmarks for debugging
      const videoWidth = webcamRef.current?.video?.videoWidth;
      const videoHeight = webcamRef.current?.video?.videoHeight;
      const canvasCtx = canvasRef.current?.getContext('2d');

      if (canvasCtx && videoWidth && videoHeight) {
        canvasRef.current.width = videoWidth;
        canvasRef.current.height = videoHeight;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, videoWidth, videoHeight);

        // Only draw if we found poses
        if (results.poseLandmarks) {
          // Draw debug skeleton
          drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: 'rgba(0, 255, 0, 0.2)', lineWidth: 1 });

          const leftShoulder = results.poseLandmarks[11];
          const rightShoulder = results.poseLandmarks[12];
          const leftHip = results.poseLandmarks[23];
          const rightHip = results.poseLandmarks[24];
          const leftKnee = results.poseLandmarks[25];
          const rightKnee = results.poseLandmarks[26];
          const leftAnkle = results.poseLandmarks[27];
          const rightAnkle = results.poseLandmarks[28];

          // ------------------------
          // 1. Draw Top (Shirt)
          // ------------------------
          if (leftShoulder && rightShoulder && leftShoulder.visibility > 0.5 && rightShoulder.visibility > 0.5 && selectedTop && selectedTop.image && topImgRef.current.complete) {
            const lX = leftShoulder.x * videoWidth;
            const lY = leftShoulder.y * videoHeight;
            const rX = rightShoulder.x * videoWidth;
            const rY = rightShoulder.y * videoHeight;

            const lHipX = leftHip.x * videoWidth;
            const lHipY = leftHip.y * videoHeight;
            const rHipX = rightHip.x * videoWidth;
            const rHipY = rightHip.y * videoHeight;

            let dx = lX - rX;
            let dy = lY - rY;
            const shoulderDist = Math.hypot(dx, dy);

            if (dx < 0) {
              dx = -dx;
              dy = -dy;
            }
            const angle = Math.atan2(dy, dx);

            let torsoHeight = shoulderDist * 2.0;
            if (leftHip && rightHip && leftHip.visibility > 0.5 && rightHip.visibility > 0.5) {
              const shoulderMidX = (lX + rX) / 2;
              const shoulderMidY = (lY + rY) / 2;
              const hipMidX = (lHipX + rHipX) / 2;
              const hipMidY = (lHipY + rHipY) / 2;
              torsoHeight = Math.hypot(hipMidX - shoulderMidX, hipMidY - shoulderMidY);
            }

            const centerX = (lX + rX) / 2;
            const centerY = (lY + rY) / 2;

            // Dynamically adapt to body shape (fatty/skinny)
            // MediaPipe hip joints are naturally narrower than shoulder joints, so we scale it up by 1.4x for comparison.
            const hipDx = lHipX - rHipX;
            const hipDy = lHipY - rHipY;
            const hipDist = Math.hypot(hipDx, hipDy);

            // The shirt will widen to fit the body if the wearer is broader at the waist (fatter),
            // and tighten to the shoulders if the wearer is narrower at the waist (skinnier).
            const effectiveBodyWidth = Math.max(shoulderDist, hipDist * 1.4);

            // Tune dimension multipliers for a tighter fit
            const drawWidth = effectiveBodyWidth * 2.0;
            const drawHeight = torsoHeight * 1.4;

            canvasCtx.save();
            canvasCtx.translate(centerX, centerY);
            canvasCtx.rotate(angle);
            // Drop the collar down slightly and stretch height down to the waist naturally
            canvasCtx.translate(-drawWidth / 2, -drawHeight * 0.15);
            canvasCtx.drawImage(topImgRef.current, 0, 0, drawWidth, drawHeight);
            canvasCtx.restore();
          }

          // ------------------------
          // 2. Draw Bottom (Pants)
          // ------------------------
          if (leftHip && rightHip && leftHip.visibility > 0.5 && rightHip.visibility > 0.5 && selectedBottom && selectedBottom.image && bottomImgRef.current.complete) {
            const lHipX = leftHip.x * videoWidth;
            const lHipY = leftHip.y * videoHeight;
            const rHipX = rightHip.x * videoWidth;
            const rHipY = rightHip.y * videoHeight;

            let dx = lHipX - rHipX;
            let dy = lHipY - rHipY;
            const hipDist = Math.hypot(dx, dy);

            if (dx < 0) {
              dx = -dx;
              dy = -dy;
            }
            const hipAngle = Math.atan2(dy, dx);

            let legLength = hipDist * 2.5;
            let hasLowerLegPoints = false;

            if (leftAnkle && rightAnkle && leftAnkle.visibility > 0.5 && rightAnkle.visibility > 0.5) {
              const hipMidX = (lHipX + rHipX) / 2;
              const hipMidY = (lHipY + rHipY) / 2;
              const ankleMidX = (leftAnkle.x * videoWidth + rightAnkle.x * videoWidth) / 2;
              const ankleMidY = (leftAnkle.y * videoHeight + rightAnkle.y * videoHeight) / 2;
              legLength = Math.hypot(ankleMidX - hipMidX, ankleMidY - hipMidY);
              hasLowerLegPoints = true;
            } else if (leftKnee && rightKnee && leftKnee.visibility > 0.5 && rightKnee.visibility > 0.5) {
              const hipMidX = (lHipX + rHipX) / 2;
              const hipMidY = (lHipY + rHipY) / 2;
              const kneeMidX = (leftKnee.x * videoWidth + rightKnee.x * videoWidth) / 2;
              const kneeMidY = (leftKnee.y * videoHeight + rightKnee.y * videoHeight) / 2;
              legLength = Math.hypot(kneeMidX - hipMidX, kneeMidY - hipMidY) * 1.8;
              hasLowerLegPoints = true;
            }

            if (hasLowerLegPoints || hipDist > 20) {
              const centerHipX = (lHipX + rHipX) / 2;
              const centerHipY = (lHipY + rHipY) / 2;

              // Pull intrinsic aspect ratio from pants image file
              const imgPantsWidth = bottomImgRef.current.naturalWidth || bottomImgRef.current.width || 500;
              const imgPantsHeight = bottomImgRef.current.naturalHeight || bottomImgRef.current.height || 500;
              const pantsRatio = imgPantsWidth / imgPantsHeight;

              // Pants need to reach the floor. Lock the height to the user's physical leg length,
              // and scale the width proportionately to prevent vertical squishing.
              // Multiply leg length by 1.1 to ensure the pants cover the ankle/shoe area.
              const targetPantsHeight = legLength * 1.1;
              let targetPantsWidth = targetPantsHeight * pantsRatio;

              // Fallback boundary: if the calculated proportionate width is impossibly skinny,
              // enforce a minimum width based on the physical hip width.
              const minWidth = hipDist * 2.2;
              if (targetPantsWidth < minWidth) {
                targetPantsWidth = minWidth;
              }

              canvasCtx.save();
              canvasCtx.translate(centerHipX, centerHipY);
              canvasCtx.rotate(hipAngle);
              // Translate up so the top covers the groin/waist
              canvasCtx.translate(-targetPantsWidth / 2, -targetPantsHeight * 0.05);
              canvasCtx.drawImage(bottomImgRef.current, 0, 0, targetPantsWidth, targetPantsHeight);
              canvasCtx.restore();
            }
          }
        }
        canvasCtx.restore();
      }
    });

    setPoseEstimator(pose);

    // Cleanup function
    return () => {
      pose.close();
    };
  }, []);

  const handleUserMedia = useCallback(() => {
    if (webcamRef.current && webcamRef.current.video && poseEstimator) {
      const camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current && webcamRef.current.video && webcamRef.current.video.readyState === 4) {
            await poseEstimator.send({ image: webcamRef.current.video });
          }
        },
        width: 1280,
        height: 720
      });
      camera.start();
    }
  }, [poseEstimator]);

  const handleCapture = useCallback(() => {
    console.log("Capture photo clicked");
  }, []);

  return (
    <div className="app-container">
      {/* Main Camera View */}
      <main className="camera-view">
        <div className="video-container">

          {/* Top UI Overlay */}
          <div className="header-overlay">
            <div className="logo-container">
              <Shirt className="logo-icon" size={24} />
              <span className="logo-text">FitMirror</span>
            </div>

            <div className="status-badge">
              <div className="status-dot"></div>
              {isModelLoading ? 'Initializing AI...' : 'Tracking Active'}
            </div>
          </div>

          {/* Webcam Feed */}
          <Webcam
            ref={webcamRef}
            className="webcam-feed"
            audio={false}
            screenshotFormat="image/jpeg"
            onUserMedia={handleUserMedia}
            videoConstraints={{
              width: 1280,
              height: 720,
              facingMode: "user"
            }}
          />

          {/* Overlay Canvas */}
          <canvas ref={canvasRef} className="output-canvas" />

          {/* Loading Overlay */}
          {isModelLoading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <div className="loading-text">Loading Pose Detection Models...</div>
            </div>
          )}

          {/* Controls Overlay */}
          <div className="controls-overlay">
            <button className="control-btn" aria-label="Switch Camera">
              <RefreshCw size={24} />
            </button>
            <button className="control-btn photo-btn" onClick={handleCapture} aria-label="Take Photo">
              <CameraIcon size={32} />
            </button>
          </div>
        </div>
      </main>

      {/* Wardrobe Sidebar */}
      <aside className="wardrobe-sidebar">
        <h2 className="sidebar-title">Your Wardrobe</h2>
        <p className="sidebar-subtitle">Select items to build your outfit</p>

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <button
            style={{
              background: 'none', border: 'none', color: activeTab === 'tops' ? '#3b82f6' : 'white',
              fontWeight: activeTab === 'tops' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1.1rem'
            }}
            onClick={() => setActiveTab('tops')}
          >
            Tops
          </button>
          <button
            style={{
              background: 'none', border: 'none', color: activeTab === 'bottoms' ? '#3b82f6' : 'white',
              fontWeight: activeTab === 'bottoms' ? 'bold' : 'normal', cursor: 'pointer', fontSize: '1.1rem'
            }}
            onClick={() => setActiveTab('bottoms')}
          >
            Bottoms
          </button>
        </div>

        <div className="clothing-grid">
          {activeTab === 'tops' && (
            <div
              className="clothing-item"
              onClick={() => document.getElementById('top-upload').click()}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.3)', cursor: 'pointer', background: 'rgba(255,255,255,0.05)' }}
            >
              <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>+</span>
              <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Upload Image</span>
              <input type="file" id="top-upload" accept="image/*" style={{ display: 'none' }} onChange={handleTopUpload} />
            </div>
          )}

          {activeTab === 'tops' && TOP_OPTIONS.map((item) => (
            <div
              key={item.id}
              className={`clothing-item ${selectedTop && selectedTop.id === item.id ? 'active' : ''}`}
              onClick={() => setSelectedTop(item)}
            >
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', position: 'absolute', bottom: '10px' }}>{item.name}</div>
              {item.image && <img src={item.image} alt={item.name} className="clothing-image" onError={(e) => { e.target.style.display = 'none'; }} />}
            </div>
          ))}

          {activeTab === 'bottoms' && (
            <div
              className="clothing-item"
              onClick={() => document.getElementById('bottom-upload').click()}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.3)', cursor: 'pointer', background: 'rgba(255,255,255,0.05)' }}
            >
              <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>+</span>
              <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Upload Pants</span>
              <input type="file" id="bottom-upload" accept="image/*" style={{ display: 'none' }} onChange={handleBottomUpload} />
            </div>
          )}

          {activeTab === 'bottoms' && BOTTOM_OPTIONS.map((item) => (
            <div
              key={item.id}
              className={`clothing-item ${selectedBottom && selectedBottom.id === item.id ? 'active' : ''}`}
              onClick={() => setSelectedBottom(item)}
            >
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', position: 'absolute', bottom: '10px' }}>{item.name}</div>
              {item.image && <img src={item.image} alt={item.name} className="clothing-image" onError={(e) => { e.target.style.display = 'none'; }} />}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default App;
