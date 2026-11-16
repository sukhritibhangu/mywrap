import api from './api';

const pickupSlotService = { getAvailableSlots: () => api.get('/pickup-slots') };
export default pickupSlotService;
