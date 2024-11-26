import cv2
import numpy as np
import tflite_runtime.interpreter as tflite
import os
import logging

logger = logging.getLogger(__name__)

class MotionDetector:
    def __init__(self):
        self.prev_frame = None
        self.motion_threshold = 25
        self.min_area = 500
        
        # Load TFLite model for person detection
        model_path = os.path.join(os.path.dirname(__file__), 'models', 'detect.tflite')
        self.interpreter = tflite.Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()
        
        # Get input and output tensors
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        
        # Initialize shape
        self.input_shape = self.input_details[0]['shape']
        
    def detect_motion(self, frame):
        """Detect motion in frame"""
        # Convert frame to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)
        
        if self.prev_frame is None:
            self.prev_frame = gray
            return False, None
            
        # Compute difference between frames
        frame_diff = cv2.absdiff(self.prev_frame, gray)
        thresh = cv2.threshold(frame_diff, self.motion_threshold, 255, cv2.THRESH_BINARY)[1]
        kernel = np.ones((3,3), np.uint8)
        thresh = cv2.dilate(thresh, kernel, iterations=2)
        
        # Find contours
        contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        motion_detected = False
        motion_regions = []
        
        for contour in contours:
            if cv2.contourArea(contour) > self.min_area:
                motion_detected = True
                (x, y, w, h) = cv2.boundingRect(contour)
                motion_regions.append((x, y, w, h))
        
        self.prev_frame = gray
        return motion_detected, motion_regions
        
    def detect_person(self, frame):
        """Detect persons in frame using TFLite model"""
        # Resize and normalize image
        input_frame = cv2.resize(frame, (self.input_shape[1], self.input_shape[2]))
        input_frame = np.expand_dims(input_frame, axis=0)
        input_frame = (input_frame.astype(np.float32) / 127.5) - 1
        
        # Set input tensor
        self.interpreter.set_tensor(self.input_details[0]['index'], input_frame)
        
        # Run inference
        self.interpreter.invoke()
        
        # Get output tensors
        boxes = self.interpreter.get_tensor(self.output_details[0]['index'])[0]
        classes = self.interpreter.get_tensor(self.output_details[1]['index'])[0]
        scores = self.interpreter.get_tensor(self.output_details[2]['index'])[0]
        
        # Person class ID in COCO dataset is 0
        person_detected = False
        person_boxes = []
        
        for i in range(len(scores)):
            if scores[i] > 0.5 and classes[i] == 0:  # Score threshold 0.5 for person class
                person_detected = True
                person_boxes.append(boxes[i])
                
        return person_detected, person_boxes

def process_frame_for_detection(frame, detector):
    """Process a frame for both motion and person detection"""
    try:
        # Detect motion first
        motion_detected, motion_regions = detector.detect_motion(frame)
        
        if motion_detected:
            # If motion detected, check for persons
            person_detected, person_boxes = detector.detect_person(frame)
            
            if person_detected:
                return True, "Person detected in motion area"
            return True, "Motion detected (no person)"
            
        return False, None
        
    except Exception as e:
        logger.error(f"Error in frame processing: {str(e)}")
        return False, str(e)
