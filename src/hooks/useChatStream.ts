import { useState, useCallback, useRef } from 'react';
import { ChatService } from '../services/awsBackend';
import { logger } from '../utils/logger';

interface UseChatStreamProps {
  onChunk: (chunk: string) => void;
  onComplete: (fullMessage: string) => void;
  onError: (error: Error) => void;
}

export const useChatStream = ({ onChunk, onComplete, onError }: UseChatStreamProps) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fullMessageRef = useRef<string>('');

  const streamMessage = useCallback(
    async (botId: string, message: string) => {
      setIsStreaming(true);
      abortControllerRef.current = new AbortController();
      fullMessageRef.current = '';

      try {
        await ChatService.streamMessage(
          botId,
          message,
          chunk => {
            if (abortControllerRef.current?.signal.aborted) return;
            fullMessageRef.current += chunk;
            onChunk(chunk);
          },
          abortControllerRef.current.signal
        );

        if (!abortControllerRef.current?.signal.aborted) {
          onComplete(fullMessageRef.current);
        }
      } catch (error) {
        if (
          (error instanceof Error && error.name === 'AbortError') ||
          abortControllerRef.current?.signal.aborted
        ) {
          logger.info('Stream cancelled by user');
          return;
        }
        logger.error('Stream error:', error);
        onError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
        fullMessageRef.current = '';
      }
    },
    [onChunk, onComplete, onError]
  );

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
