import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import API_BASE_URL from '../config';

import './CreateStudentForm.css';

const CreateStudentForm = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    username: '',
    password: '',
    confirm_password: '',
    gender: '',
    classroom: '',
    academic_year: '',
    term: '',
    date_of_birth: '',
    department: ''
  });

  const [classrooms, setClassrooms] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [message, setMessage] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const token = localStorage.getItem('accessToken');

  const DEPARTMENTS = ['Science', 'Arts', 'Commercial'];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classRes, sessionRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/academics/classes/`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_BASE_URL}/api/academics/sessions/`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        setClassrooms(classRes.data);

        const years = sessionRes.data.map(session => session.academic_year);
        const uniqueYears = [...new Set(years)];
        setAcademicYears(uniqueYears);
      } catch (err) {
        console.error('Error fetching classes or sessions:', err);
      }
    };

    fetchData();
  }, [token]);

  useEffect(() => {
    // Cleanup camera stream on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleChange = e => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 100 * 1024) {
        setMessage('Image file size must not exceed 100KB.');
        return;
      }
      setProfilePicture(file);
      setPreviewUrl(URL.createObjectURL(file));
      setMessage('');
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      setStream(mediaStream);
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setMessage('Unable to access camera. Please check permissions.');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = 120;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');

      // Calculate crop dimensions to maintain aspect ratio
      const videoAspect = video.videoWidth / video.videoHeight;
      const targetAspect = 120 / 150;

      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = video.videoWidth;
      let sourceHeight = video.videoHeight;

      if (videoAspect > targetAspect) {
        sourceWidth = video.videoHeight * targetAspect;
        sourceX = (video.videoWidth - sourceWidth) / 2;
      } else {
        sourceHeight = video.videoWidth / targetAspect;
        sourceY = (video.videoHeight - sourceHeight) / 2;
      }

      ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 120, 150);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
          setProfilePicture(file);
          setPreviewUrl(URL.createObjectURL(file));
          stopCamera();
          setMessage('');
        }
      }, 'image/jpeg', 0.85);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const removePhoto = () => {
    setProfilePicture(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');

    if (formData.password !== formData.confirm_password) {
      setMessage('Passwords do not match.');
      return;
    }

    const payload = new FormData();
    Object.keys(formData).forEach(key => {
      if (formData[key]) {
        payload.append(key, formData[key]);
      }
    });
    payload.append('role', 'student');

    if (profilePicture) {
      payload.append('profile_picture', profilePicture);
    }

    try {
      await axios.post(
        `${API_BASE_URL}/api/users/create-user/`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setMessage('Student created successfully.');
      setFormData({
        first_name: '',
        middle_name: '',
        last_name: '',
        username: '',
        password: '',
        confirm_password: '',
        gender: '',
        classroom: '',
        academic_year: '',
        term: '',
        date_of_birth: '',
        department: ''
      });
      setProfilePicture(null);
      setPreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error creating student:', err);
      if (err.response?.data) {
        const errors = Object.entries(err.response.data)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
          .join('\n');
        setMessage(errors || 'Failed to create student. Please try again.');
      } else {
        setMessage('Failed to create student. Please try again.');
      }
    }
  };

  const selectedClassName = classrooms.find(cls => cls.id.toString() === formData.classroom)?.name;
  const isSeniorClass = selectedClassName?.startsWith('S.S.S.');

  return (
    <div className="create-student-wrapper">
      <div className="create-student-container">
        <h3>Create Student</h3>
        <form onSubmit={handleSubmit} className="create-student-form">
          <input type="text" name="first_name" placeholder="First Name" value={formData.first_name} onChange={handleChange} required />
          <input type="text" name="middle_name" placeholder="Middle Name (optional)" value={formData.middle_name} onChange={handleChange} />
          <input type="text" name="last_name" placeholder="Last Name" value={formData.last_name} onChange={handleChange} required />
          <input type="text" name="username" placeholder="Username" value={formData.username} onChange={handleChange} required />
          <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} required />
          <input type="password" name="confirm_password" placeholder="Confirm Password" value={formData.confirm_password} onChange={handleChange} required />

          <select name="gender" value={formData.gender} onChange={handleChange} required>
            <option value="">Select Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          <select name="classroom" value={formData.classroom} onChange={handleChange} required>
            <option value="">Select Class</option>
            {classrooms.map(cls => (
              <option key={cls.id} value={cls.id}>{cls.name}</option>
            ))}
          </select>

          {isSeniorClass && (
            <select name="department" value={formData.department} onChange={handleChange} required>
              <option value="">Select Department</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          )}

          <select name="academic_year" value={formData.academic_year} onChange={handleChange} required>
            <option value="">Select Academic Year</option>
            {academicYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>

          <select name="term" value={formData.term} onChange={handleChange} required>
            <option value="">Select Term</option>
            <option value="First Term">First Term</option>
            <option value="Second Term">Second Term</option>
            <option value="Third Term">Third Term</option>
          </select>

          <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} required />

          <div className="photo-upload-section">
            <label>Student Photo (optional, max 100KB)</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              style={{ display: 'none' }}
            />

            {!previewUrl && !showCamera && (
              <div className="photo-buttons">
                <button type="button" onClick={handleUploadClick} className="upload-btn">
                  Upload Photo
                </button>
                <button type="button" onClick={startCamera} className="camera-btn">
                  Take Photo
                </button>
              </div>
            )}

            {showCamera && (
              <div className="camera-container">
                <video ref={videoRef} autoPlay playsInline className="camera-video" />
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                <div className="camera-controls">
                  <button type="button" onClick={capturePhoto} className="capture-btn">
                    Capture
                  </button>
                  <button type="button" onClick={stopCamera} className="cancel-btn">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {previewUrl && (
              <div className="photo-preview">
                <img src={previewUrl} alt="Student preview" className="preview-image" />
                <button type="button" onClick={removePhoto} className="remove-photo-btn">
                  Remove Photo
                </button>
              </div>
            )}
          </div>

          <button type="submit">Create Student</button>
        </form>

        {message && (
          <p className={`form-message ${message.includes('successfully') ? 'success' : 'error'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default CreateStudentForm;
