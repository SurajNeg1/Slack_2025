import { useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { getStreamToken } from "../lib/api";
import { StreamChat } from "stream-chat";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

export const useStreamChat = () => {

    const { user } = useUser();
    const [chatClient, setChatClient] = useState(null);
    const {
        data: tokenData,
        isLoading,
        error
    } = useQuery({
        queryKey: ['stream-token'],
        queryFn: getStreamToken,
        enabled: !!user?.id
    })

    useEffect(() => {
        const init = async () => {
            if (!tokenData?.token & !user) return;
            
            try {
                const client = StreamChat.getInstance(STREAM_API_KEY);
                let cancelled = false;
                await client.connectUser({
                    id: user.id,
                    name: user.fullName,
                    image: user.imageUrl
                }, tokenData.token);

                if(!cancelled) setChatClient(client);
            } catch (error) {
                console.log("Error connecting to Stream Chat:", error);
                SentryContextManager.captureException(error,
                    {
                        tags: { component: "useStreamChat" }
                    }
                );
            }

        }
        init();

        return () => {
            if (chatClient) {
                chatClient.disconnectUser();
                cancelled = true;
            }
        }

    }, [tokenData, user]);


    return {chatClient, isLoading, error };
}