import React from "react"
import { Link } from "react-router-dom"

export default function RootStaticPreview(){
  return (
    <div style={{padding:22,fontFamily:"Inter, system-ui",maxWidth:820}}>
      <h1 style={{marginBottom:8}}>WellMate — Static Preview</h1>
      <p style={{color:"#666",marginBottom:16}}>This static preview page is preview-only and safe to remove later. Use the links below to open real app screens.</p>
      <div style={{display:"grid",gap:10,gridTemplateColumns:"1fr 1fr",maxWidth:520}}>
        <Link to="/onboarding" style={{padding:12,background:"#e6f4ea",borderRadius:8,textDecoration:"none",textAlign:"center"}}>Open Onboarding</Link>
        <Link to="/physical" style={{padding:12,background:"#e8f0ff",borderRadius:8,textDecoration:"none",textAlign:"center"}}>Open Physical Dashboard</Link>
        <Link to="/habits" style={{padding:12,background:"#fff4e6",borderRadius:8,textDecoration:"none",textAlign:"center"}}>Open Habits</Link>
        <Link to="/sleep" style={{padding:12,background:"#f0e6ff",borderRadius:8,textDecoration:"none",textAlign:"center"}}>Open Sleep</Link>
        <Link to="/mental/ai" style={{padding:12,background:"#ffe6f0",borderRadius:8,textDecoration:"none",textAlign:"center"}}>Open AI Mental Coach</Link>
        <Link to="/dev-preview" style={{padding:12,background:"#f6f6f6",borderRadius:8,textDecoration:"none",textAlign:"center"}}>Open Dev Preview</Link>
      </div>
      <p style={{color:"#999",marginTop:16,fontSize:13}}>
        If this page renders, the Hercules preview is working. If you want to remove the static preview later, replace the "/" route back to your original RootRedirect.
      </p>
    </div>
  )
}
