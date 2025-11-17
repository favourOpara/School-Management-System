import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Select from 'react-select';
import './EditUserModal.css';

const EditUserModal = ({ user, onClose, onUpdated }) => {
  const [classrooms, setClassrooms] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    middle_name: '',
    gender: '',
    username: '',
    password: '',
    confirm_password: '',
    classroom: '',
    academic_year: '',
    term: '',
    date_of_birth: '',
    department: '',
  });

  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [message, setMessage] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    setFormData({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      middle_name: user.middle_name || '',
      gender: user.gender || '',
      username: user.username || '',
      classroom: user.classroom || '',
      academic_year: user.academic_year || '',
      term: user.term || '',
      date_of_birth: user.date_of_birth || '',
      department: user.department || '',
      password: '',
      confirm_password: '',
    });

    // Set current photo URL if exists
    if (user.profile_picture) {
      setCurrentPhotoUrl(user.profile_picture);
    }
  }, [user]);

  useEffect(() => {
    // Cleanup camera stream on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const classRes = await axios.get('http://127.0.0.1:8000/api/academics/classes/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setClassrooms(classRes.data);

        const sessionRes = await axios.get('http://127.0.0.1:8000/api/academics/sessions/', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const years = [...new Set(sessionRes.data.map(s => s.academic_year))];
        setAcademicYears(years);
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };

    fetchData();
  }, [token]);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSelectChange = (selectedOption, { name }) => {
    setFormData(prev => ({
      ...prev,
      [name]: selectedOption ? selectedOption.value : ''
    }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = new FormData();

      // Add all form fields
      Object.keys(formData).forEach(key => {
        if (formData[key]) {
          payload.append(key, formData[key]);
        }
      });

      payload.append('role', 'student');

      if (formData.classroom === '') {
        payload.set('classroom', '');
      }

      if (!formData.password) {
        payload.delete('password');
        payload.delete('confirm_password');
      }

      if (!formData.date_of_birth) {
        payload.delete('date_of_birth');
      }

      if (!formData.department) {
        payload.delete('department');
      }

      // Add profile picture if selected
      if (profilePicture) {
        payload.append('profile_picture', profilePicture);
      }

      const res = await axios.put(`http://127.0.0.1:8000/api/users/${user.id}/`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('User updated successfully.');
      onClose();
      if (onUpdated) onUpdated(res.data);
    } catch (err) {
      console.error('Error updating user:', err);
      if (err.response?.data) {
        const errors = Object.entries(err.response.data)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
          .join('\n');
        alert(errors || 'Failed to update user.');
      } else {
        alert('Failed to update user.');
      }
    }
  };

  const selectedClassroomName = classrooms.find(c => c.id === formData.classroom)?.name || '';

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <h3>Edit Student</h3>
        <form onSubmit={handleSubmit} className="edit-user-form">
          <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} placeholder="First Name" required />
          <input type="text" name="middle_name" value={formData.middle_name} onChange={handleChange} placeholder="Middle Name (Optional)" />
          <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} placeholder="Last Name" required />
          <input type="text" name="username" value={formData.username} onChange={handleChange} placeholder="Username" required />

          {/* Gender Select */}
          <Select
            classNamePrefix="react-select"
            name="gender"
            value={formData.gender ? { value: formData.gender, label: formData.gender } : null}
            onChange={handleSelectChange}
            options={[
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' }
            ]}
            placeholder="Select Gender"
            isClearable
          />

          {/* Classroom Select */}
          <Select
            classNamePrefix="react-select"
            name="classroom"
            value={formData.classroom ? { value: formData.classroom, label: classrooms.find(c => c.id === formData.classroom)?.name || 'Class' } : null}
            onChange={handleSelectChange}
            options={classrooms.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Select Class"
            isClearable
          />

          {/* Department Select */}
          {selectedClassroomName.startsWith('S.S.S.') && (
            <Select
              classNamePrefix="react-select"
              name="department"
              value={formData.department ? { value: formData.department, label: formData.department } : null}
              onChange={handleSelectChange}
              options={[
                { value: 'Science', label: 'Science' },
                { value: 'Arts', label: 'Arts' },
                { value: 'Commercial', label: 'Commercial' }
              ]}
              placeholder="Select Department"
              isClearable
            />
          )}

          {/* Academic Year Select */}
          <Select
            classNamePrefix="react-select"
            name="academic_year"
            value={formData.academic_year ? { value: formData.academic_year, label: formData.academic_year } : null}
            onChange={handleSelectChange}
            options={academicYears.map(year => ({ value: year, label: year }))}
            placeholder="Select Academic Year"
            isClearable
          />

          {/* Term Select */}
          <Select
            classNamePrefix="react-select"
            name="term"
            value={formData.term ? { value: formData.term, label: formData.term } : null}
            onChange={handleSelectChange}
            options={[
              { value: 'First Term', label: 'First Term' },
              { value: 'Second Term', label: 'Second Term' },
              { value: 'Third Term', label: 'Third Term' }
            ]}
            placeholder="Select Term"
            isClearable
          />

          <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} placeholder="Date of Birth" />

          {/* Password Fields */}
          <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="New Password (Optional)" />
          <input type="password" name="confirm_password" value={formData.confirm_password} onChange={handleChange} placeholder="Confirm Password" />

          {/* Photo Upload Section */}
          <div className="edit-photo-upload-section">
            <label>Student Photo (max 100KB)</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              style={{ display: 'none' }}
            />

            {/* Show current photo if exists and no new photo selected */}
            {currentPhotoUrl && !previewUrl && !showCamera && (
              <div className="current-photo">
                <p className="photo-label">Current Photo:</p>
                <img src={currentPhotoUrl} alt="Current student" className="current-photo-img" />
              </div>
            )}

            {!previewUrl && !showCamera && (
              <div className="photo-buttons">
                <button type="button" onClick={handleUploadClick} className="upload-btn">
                  {currentPhotoUrl ? 'Change Photo' : 'Upload Photo'}
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
                <p className="photo-label">New Photo:</p>
                <img src={previewUrl} alt="New student preview" className="preview-image" />
                <button type="button" onClick={removePhoto} className="remove-photo-btn">
                  Remove
                </button>
              </div>
            )}

            {message && <p className="photo-error-message">{message}</p>}
          </div>

          <div className="button-group">
            <button type="submit" className="edit_user_save-btn">Save Changes</button>
            <button type="button" onClick={onClose} className="edit_user_close-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditUserModal;
