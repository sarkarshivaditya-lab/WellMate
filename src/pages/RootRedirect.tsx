import React, {useEffect, useState} from "react"
import {Navigate} from "react-router-dom"
import {useQuery} from "convex/react"
import {api} from "../../convex/_generated/api"

export default function RootRedirect(){
  const profile = useQuery(api.users.getCurrentUser)
  const [fallbackToOnboarding,setFallbackToOnboarding] = useState(false)

  useEffect(()=>{
    const t = setTimeout(()=> setFallbackToOnboarding(true), 900)
    return ()=> clearTimeout(t)
  },[])

  if(profile === undefined && !fallbackToOnboarding){
    return (
      <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div aria-busy="true" style={{textAlign:"center"}}>
          <div style={{width:40,height:40,borderRadius:20,background:"#e6f4ea",margin:"0 auto 8px"}}/>
          <div style={{fontSize:14,color:"#666"}}>Loading…</div>
        </div>
      </div>
    )
  }

  if(profile === undefined && fallbackToOnboarding) return <Navigate to="/onboarding" replace/>

  if(!profile || !profile.hasCompletedOnboarding) return <Navigate to="/onboarding" replace/>

  return <Navigate to="/physical" replace/>
}
