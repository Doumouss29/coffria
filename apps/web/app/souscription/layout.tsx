'use client';
import { useEffect } from 'react';

export default function Layout({children}:{children:React.ReactNode}){
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const plan=params.get('plan');
    if(plan) sessionStorage.setItem(`coffria_period_step_${plan}`,'1');
  },[]);
  return <>{children}</>;
}
