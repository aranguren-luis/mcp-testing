require('dotenv').config();
const axios = require('axios');

async function listProjects() {
  const YOUTRACK_BASE_URL = process.env.YOUTRACK_BASE_URL;
  const YOUTRACK_TOKEN = process.env.YOUTRACK_TOKEN;

  try {
    const response = await axios.get(`${YOUTRACK_BASE_URL}/api/admin/projects?fields=id,name,shortName`, {
      headers: {
        'Authorization': `Bearer ${YOUTRACK_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    console.log('Proyectos disponibles:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error al listar proyectos:', error.response?.data || error.message);
  }
}

listProjects();
