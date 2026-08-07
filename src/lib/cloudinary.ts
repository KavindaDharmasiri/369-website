export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
}

export const getCloudinaryUrl = (publicId: string, transformations?: string) => {
  const baseUrl = `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload`
  return transformations 
    ? `${baseUrl}/${transformations}/${publicId}`
    : `${baseUrl}/${publicId}`
}

export const getOptimizedImageUrl = (url: string, transforms = 'w_600,q_auto,f_auto') => {
  if (!url) return url
  const marker = '/image/upload/'
  const idx = url.indexOf(marker)
  if (idx === -1) return url
  return `${url.slice(0, idx + marker.length)}${transforms}/${url.slice(idx + marker.length)}`
}
