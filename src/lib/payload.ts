import config from '@payload-config'
import { getPayload } from 'payload'

export const payload = () => getPayload({ config })
export { formatAUD, formatDate, formatMoney } from './format'
