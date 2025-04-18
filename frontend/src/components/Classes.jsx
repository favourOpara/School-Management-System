import React, { useEffect, useState } from 'react';
import ClassForm from '../components/ClassForm';
import ClassList from '../components/ClassList';
import axios from 'axios';
import { useLoading } from '../context/LoadingContext';

const Classes = () => {
  const [classes, setClasses] = useState([]);
  const [message, setMessage] = useState('');
  const { showLoader, hideLoader } = useLoading();

  const fetchClasses = async () => {
    showLoader();
    try {
      const token = localStorage.getItem('accessToken');
      const res = await axios.get('http://127.0.0.1:8000/api/admin/classes/', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setClasses(res.data);
    } catch {
      setMessage('Failed to fetch classes.');
    } finally {
      hideLoader();
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  return (
    <div>
      <h3>Manage Classes</h3>
      <ClassForm onSuccess={fetchClasses} />
      <hr style={{ margin: '2rem 0' }} />
      <ClassList classes={classes} onRefresh={fetchClasses} />
      {message && <p>{message}</p>}
    </div>
  );
};

export default Classes;
