import React, {useEffect, useState} from "react"
import {Navigate} from "react-router-dom"

export default function RootRedirect() {
  const [doFallback, setDoFallback] = useState(false)
  useEffect(()=>{
    const t = setTimeout(()=> setDoFallback(true), 300)
    return ()=> clearTimeout(t)
  },[])

  if (!doFallback) {
    return (
      <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{textAlign:"center",color:"#666"}}>Loading…</div>
      </div>
    )
  }

  return <Navigate to="/onboarding" replace />
}
