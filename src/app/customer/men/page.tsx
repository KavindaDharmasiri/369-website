import { permanentRedirect } from 'next/navigation'

export default function Men() {
  permanentRedirect('/customer/category?type=men')
}
