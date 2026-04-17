import axios from 'axios'

const api = axios.create({
	baseURL: import.meta.env.VITE_API_BASE_URL || '',
	timeout: 15000,
})

api.interceptors.request.use((config) => {
	const headers = config.headers || {}
	const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
	const initData = webApp?.initData

	if (initData) {
		headers.Authorization = `tma ${initData}`
	} else {
		headers.Authorization = 'dev_bypass'
		if (import.meta.env.VITE_DEV_USER_ID) {
			headers['x-dev-user-id'] = import.meta.env.VITE_DEV_USER_ID
		}
	}

	config.headers = headers
	return config
})

export default api
