import { FC, useMemo } from 'react';
import { useMessages } from '../../hooks/useMessages';

export const ProgressReport: FC<{
  eventId: string;
}> = ({ eventId }) => {
  const messages = useMessages(eventId);

  const filteredMessages = useMemo(() => {
    let currentIndex = 0;
    const out = [];

    for (const msg of messages ?? []) {
      if (msg.message.toLowerCase().indexOf('progress') === -1 && msg.message.indexOf('Queue position') === -1) {
        currentIndex++;
      }
      out[currentIndex] = msg;
    }
    return out;
  }, [messages]);

  return (
    <>
      {(filteredMessages?.length ?? 0) > 0 && (
        <>
          <div
            style={{
              width: '100%',
              gap: 12,
              marginBottom: 24,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {filteredMessages?.map(msg => (
              <div key={msg._id} style={{ fontSize: 14, fontStyle: 'italic' }}>
                {msg.message}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
};
