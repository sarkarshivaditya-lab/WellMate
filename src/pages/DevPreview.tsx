import React from "react"
import { Link } from "react-router-dom"

export default function DevPreview() {
  return (
    <div style={{padding:24,fontFamily:"Inter, system-ui"}}>
      <h2>WellMate Dev Preview</h2>
      <p>Quick links:</p>
      <ul>
        <li><Link to="/onboarding">Onboarding</Link></li>
        <li><Link to="/physical">Physical (dashboard)</Link></li>
        <li><Link to="/habits">Habits</Link></li>
        <li><Link to="/sleep">Sleep</Link></li>
        <li><Link to="/mental/ai">AI Mental Coach</Link></li>
      </ul>
      <p style={{color:"#666"}}>Use this page if the main root redirect still blocks in preview.</p>
    </div>
  )
}
