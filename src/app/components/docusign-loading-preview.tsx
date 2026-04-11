export function DocuSignLoadingPreview() {
  return (
    <div style={{
      fontFamily: "Inter, sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      margin: 0,
      background: "#F5F3EF",
    }}>
      <img
        src="https://yohhdvwifjgarnaxrbev.supabase.co/storage/v1/object/public/assets/ba-blacktext-logo-cropped.png"
        alt="Butler & Associates Construction"
        style={{ height: 40, width: "auto", objectFit: "contain", marginBottom: 24, mixBlendMode: "multiply" as any }}
      />
      <div style={{
        width: 32,
        height: 32,
        border: "3px solid #E8E4DC",
        borderTop: "3px solid #BB984D",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
        marginBottom: 16,
      }} />
      <p style={{ color: "#3A3A38", fontSize: 15, margin: 0, opacity: 0.7 }}>
        Loading DocuSign, please wait...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
