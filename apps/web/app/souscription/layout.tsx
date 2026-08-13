'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

export default function Layout({children}:{children:React.ReactNode}){
  const params=useSearchParams();
  useEffect(()=>{
    const plan=params.get('plan');
    if(plan) sessionStorage.setItem(`coffria_period_step_${plan}`,'1');
  },[params]);
  return <>{children}</>;
}
