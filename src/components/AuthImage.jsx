import { useState } from "react";

export default function AuthImage({
  src,
  alt = "",
  className = "",
  fallback = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
}) {
  const [hasError, setHasError] = useState(false);

  const displaySrc = (!hasError && src) ? src : fallback;

  return (
    <img
      src={displaySrc}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}
