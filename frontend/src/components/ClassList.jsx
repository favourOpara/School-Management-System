import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLoading } from '../context/LoadingContext';

const ClassList = ({ classes, onRefresh }) => {
    const [editId, setEditId] = useState(null);
    const [editData, setEditData] = useState({ name: '', description: '' });
    const [message, setMessage] = useState('');
    const { showLoader, hideLoader } = useLoading();
    const token = localStorage.getItem('accessToken');
    
  
    const startEdit = (cls) => {
      setEditId(cls.id);
      setEditData({ name: cls.name, description: cls.description });
    };
  
    const cancelEdit = () => {
      setEditId(null);
      setEditData({ name: '', description: '' });
    };
  
    const handleEditChange = (e) => {
      setEditData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
  
    const submitEdit = async () => {
      showLoader();
      try {
        await axios.put(`http://127.0.0.1:8000/api/admin/classes/${editId}/`, editData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage('Class updated.');
        cancelEdit();
        onRefresh();
      } catch {
        setMessage('Failed to update class.');
      } finally {
        hideLoader();
      }
    };
  
    const deleteClass = async (id) => {
      const confirm = window.confirm('Delete this class?');
      if (!confirm) return;
  
      showLoader();
      try {
        await axios.delete(`http://127.0.0.1:8000/api/admin/classes/${id}/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMessage('Class deleted.');
        onRefresh();
      } catch {
        setMessage('Failed to delete class.');
      } finally {
        hideLoader();
      }
    };
  
    return (
      <ul>
        {classes.map(cls => (
          <li key={cls.id} style={{ marginBottom: '1rem' }}>
            {editId === cls.id ? (
              <div>
                <input name="name" value={editData.name} onChange={handleEditChange} />
                <textarea name="description" value={editData.description} onChange={handleEditChange} />
                <button onClick={submitEdit}>Save</button>
                <button onClick={cancelEdit}>Cancel</button>
              </div>
            ) : (
              <div>
                <strong>{cls.name}</strong>: {cls.description}
                <br />
                <button onClick={() => startEdit(cls)}>Edit</button>
                <button onClick={() => deleteClass(cls.id)}>Delete</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  };
  
  export default ClassList;
  