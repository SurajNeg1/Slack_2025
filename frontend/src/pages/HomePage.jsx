import React, { useEffect, useState } from 'react'
import { UserButton } from '@clerk/clerk-react'
import { useSearchParams } from 'react-router'
import { useStreamChat } from '../hooks/useStreamChat'

function HomePage() {

  const [createChannelModalOpen, setCreateChannelModalOpen] = useState(false)
  const [activeChannel , setActiveChannel] = useState(null)
  const [searchParams , setSearchParams] = useSearchParams()
  const { chatClient, isLoading, error } = useStreamChat()

  useEffect(()=>{
    if(chatClient){
      const channelId = searchParams.get('channel')
  
      if(channelId){
        const channel = chatClient.channel('messaging', channelId);
        setActiveChannel(channel)
      }
    }
  },[chatClient, searchParams])


  if(error) return <div>Error loading chat client: {error}</div>;

  return (
    <div>
        <UserButton />
        <h1>Home Page</h1>
    </div>
  )
}

export default HomePage
