import { useState, useCallback, useRef } from 'react';
import { ChatService } from '../services/awsBackend';

interface UseChatStreamProps {
    onChunk: (chunk: string) => void;
    onComplete: (fullMessage: string) => void;
    onError: (error: any) => void;
}

export const useChatStream = ({ onChunk, onComplete, onError }: UseChatStreamProps) => {
    const [isStreaming, setIsStreaming] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const streamMessage = useCallback(async (botId: string, message: string) => {
        setIsStreaming(true);
        abortControllerRef.current = new AbortController();

        try {
            // In a real implementation, this would use fetch with a ReadableStream
            // For now, we use the simulated streaming service
            await ChatService.streamMessage(botId, message, (chunk) => {
                if (abortControllerRef.current?.signal.aborted) return;
                onChunk(chunk);
            });

            onComplete(''); // The full message is built up by chunks in the parent
        } catch (error) {
            if (abortControllerRef.current?.signal.aborted) return;
            onError(error);
        } finally {
            setIsStreaming(false);
            abortControllerRef.current = null;
        }
    }, [onChunk, onComplete, onError]);

    const stopStream = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsStreaming(false);
        }
    }, []);

    return {
        isStreaming,
        streamMessage,
        stopStream,
    };
};
