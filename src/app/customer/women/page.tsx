import { permanentRedirect } from 'next/navigation'

export default function Women() {
  permanentRedirect('/customer/category?type=women')
}
