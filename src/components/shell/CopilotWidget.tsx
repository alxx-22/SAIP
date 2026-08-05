import { useEffect, useRef, useState } from 'react';
import { Box, Text, TextInput } from 'grommet';
import { Chat, Close, Send } from 'grommet-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { duration, easing, glow, spring, stagger } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import {
  SEEDED_CONVERSATION,
  SUGGESTED_PROMPTS,
  TYPING_DELAY_MS,
  placeholderReply,
  type ChatMessage,
} from './copilotPlaceholder';

/**
 * Copilot Studio slot.
 *
 * SCOPE NOTE: the original brief scoped this to "container only". A working
 * placeholder conversation was added later at the client's request so the
 * interaction can be demonstrated. It is still NOT a real assistant — every
 * reply is the same canned message from `copilotPlaceholder.ts`, and that file
 * plus this component's message state are what the real Copilot Studio embed
 * replaces.
 *
 * TO EMBED THE REAL BOT: swap the <MessageList>/<Composer> block for the
 * Copilot Studio <iframe> and delete `copilotPlaceholder.ts`. The launcher,
 * panel, open/close animation, focus handling and layout stay as they are.
 *
 * Launcher colour: `--hpe-color-decorative-brand` (#01a982, the HPE Brand
 * green) with a white icon. The default `icon-onPrimaryStrong` token resolves
 * to near-black (#292d3a) in light mode, which is why white is set explicitly
 * here. See README for the contrast measurement.
 */
export function CopilotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(SEEDED_CONVERSATION);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const { reduced } = useAppMotion();

  const replyTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(replyTimer.current), []);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || typing) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };
    setMessages((m) => [...m, userMessage]);
    setDraft('');
    setTyping(true);

    // The delay is what makes the typing indicator meaningful — without it the
    // reply would appear before the indicator had rendered.
    replyTimer.current = window.setTimeout(
      () => {
        setMessages((m) => [
          ...m,
          { id: `a-${Date.now()}`, role: 'assistant', text: placeholderReply(trimmed) },
        ]);
        setTyping(false);
      },
      reduced ? 300 : TYPING_DELAY_MS,
    );
  }

  return (
    <Box
      style={{
        position: 'fixed',
        right: 'var(--hpe-spacing-medium)',
        bottom: 'var(--hpe-spacing-medium)',
        zIndex: 30,
        alignItems: 'flex-end',
      }}
      flex={false}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            key="copilot-panel"
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduced
                ? { opacity: 0 }
                : {
                    opacity: 0,
                    y: 12,
                    scale: 0.96,
                    transition: { duration: duration.exit, ease: easing.in },
                  }
            }
            transition={reduced ? { duration: 0 } : spring.soft}
            style={{ transformOrigin: 'bottom right', marginBottom: 12 }}
          >
            <Box
              width="380px"
              height="520px"
              round="medium"
              background="background-front"
              border={{ color: 'border-weak' }}
              elevation="large"
              overflow="hidden"
              role="dialog"
              aria-label="SAIP assistant"
            >
              <PanelHeader onClose={() => setOpen(false)} reduced={reduced} />
              <MessageList messages={messages} typing={typing} reduced={reduced} />
              <Composer
                draft={draft}
                setDraft={setDraft}
                onSend={send}
                disabled={typing}
                showPrompts={messages.length <= SEEDED_CONVERSATION.length}
                reduced={reduced}
              />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      <CopilotLauncher open={open} reduced={reduced} onToggle={() => setOpen((v) => !v)} />
    </Box>
  );
}

/** Brand-green header with the placeholder disclosure. */
function PanelHeader({ onClose, reduced }: { onClose: () => void; reduced: boolean }) {
  return (
    <Box
      direction="row"
      align="center"
      justify="between"
      pad={{ horizontal: 'small', vertical: 'xsmall' }}
      flex={false}
      /*
        green-700, not the brand green used on the launcher.
        White on the brand green (#01a982) measures 3.00:1 — fine for an icon
        (WCAG 1.4.11 needs 3:1) but short of the 4.5:1 that small text needs.
        green-700 (#068667) gives 4.55:1, so the header text is actually
        readable. The launcher keeps the brighter brand green because it
        carries an icon, not prose.
      */
      style={{ background: 'var(--hpe-color-background-primary-strong)' }}
    >
      <Box gap="1px">
        <Text size="small" weight={600} style={{ color: '#ffffff' }}>
          SAIP Assistant
        </Text>
        {/* Placeholder disclosure lives in the chrome so it can't be scrolled
            away from — nobody should mistake this for a working assistant. */}
        <Text size="xsmall" style={{ color: '#ffffff', opacity: 0.85 }}>
          Placeholder — not connected to Copilot Studio
        </Text>
      </Box>
      <motion.button
        type="button"
        onClick={onClose}
        aria-label="Close assistant"
        whileHover={reduced ? undefined : { scale: 1.15, rotate: 90 }}
        whileTap={reduced ? undefined : { scale: 0.9 }}
        transition={spring.snappy}
        style={{
          display: 'flex',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 4,
        }}
      >
        <Close size="small" color="#ffffff" />
      </motion.button>
    </Box>
  );
}

/**
 * Scrolling transcript.
 *
 * Auto-scrolls to the newest message. `aria-live="polite"` announces incoming
 * replies without interrupting whatever the user is doing.
 */
function MessageList({
  messages,
  typing,
  reduced,
}: {
  messages: ChatMessage[];
  typing: boolean;
  reduced: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [messages, typing, reduced]);

  return (
    <Box
      flex
      pad="small"
      gap="xsmall"
      overflow={{ vertical: 'auto' }}
      background="background-back"
      aria-live="polite"
      aria-label="Conversation"
    >
      {messages.map((message, i) => (
        <Bubble
          key={message.id}
          message={message}
          reduced={reduced}
          // Seeded messages cascade in on first open; live ones pop as they land.
          delay={message.seeded ? i * stagger.card : 0}
        />
      ))}

      <AnimatePresence>{typing && <TypingIndicator reduced={reduced} />}</AnimatePresence>

      <div ref={endRef} />
    </Box>
  );
}

/** A single message. Enters from its own side of the conversation. */
function Bubble({
  message,
  reduced,
  delay,
}: {
  message: ChatMessage;
  reduced: boolean;
  delay: number;
}) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={
        reduced
          ? false
          : { opacity: 0, y: 12, scale: 0.9, x: isUser ? 16 : -16 }
      }
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      transition={reduced ? { duration: 0 } : { ...spring.snappy, delay }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        transformOrigin: isUser ? 'bottom right' : 'bottom left',
      }}
    >
      <Box
        pad={{ horizontal: 'small', vertical: 'xsmall' }}
        width={{ max: '84%' }}
        flex={false}
        style={{
          // green-700 for the same contrast reason as the header — these
          // bubbles carry body text at 14px, which needs 4.5:1.
          background: isUser
            ? 'var(--hpe-color-background-primary-strong)'
            : 'var(--hpe-color-background-front)',
          color: isUser ? '#ffffff' : 'var(--hpe-color-text-default)',
          border: isUser ? 'none' : '1px solid var(--hpe-color-border-weak)',
          // The squared-off corner points at whoever is speaking.
          borderRadius: 'var(--hpe-radius-medium)',
          borderBottomRightRadius: isUser ? '4px' : undefined,
          borderBottomLeftRadius: isUser ? undefined : '4px',
        }}
      >
        <Text size="small" style={{ color: 'inherit' }}>
          {message.text}
        </Text>
      </Box>
    </motion.div>
  );
}

/** Three dots that bounce in sequence while the reply is pending. */
function TypingIndicator({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 4 }}
      transition={reduced ? { duration: 0 } : spring.snappy}
      style={{ display: 'flex', justifyContent: 'flex-start' }}
    >
      <Box
        direction="row"
        gap="4px"
        align="center"
        pad={{ horizontal: 'small', vertical: 'small' }}
        round="medium"
        background="background-front"
        border={{ color: 'border-weak' }}
        flex={false}
        // Announced as text so the state isn't dots-only for screen readers.
        aria-label="Assistant is typing"
        role="status"
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            animate={reduced ? undefined : { y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
            transition={
              reduced
                ? undefined
                : {
                    duration: 0.9,
                    ease: easing.inOut,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }
            }
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--hpe-color-decorative-brand)',
            }}
          />
        ))}
      </Box>
    </motion.div>
  );
}

/** Text entry, send button and the suggested-prompt chips. */
function Composer({
  draft,
  setDraft,
  onSend,
  disabled,
  showPrompts,
  reduced,
}: {
  draft: string;
  setDraft: (v: string) => void;
  onSend: (text: string) => void;
  disabled: boolean;
  showPrompts: boolean;
  reduced: boolean;
}) {
  const canSend = draft.trim().length > 0 && !disabled;

  return (
    <Box
      flex={false}
      pad="small"
      gap="xsmall"
      background="background-front"
      border={{ side: 'top', color: 'border-weak' }}
    >
      <AnimatePresence>
        {showPrompts && (
          <motion.div
            initial={reduced ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, height: 0, transition: { duration: duration.exit } }
            }
            transition={{ duration: duration.standard, ease: easing.out }}
            style={{ overflow: 'hidden' }}
          >
            <Box direction="row" gap="4px" wrap>
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <motion.button
                  key={prompt}
                  type="button"
                  onClick={() => onSend(prompt)}
                  disabled={disabled}
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduced ? { duration: 0 } : { ...spring.snappy, delay: 0.1 + i * 0.06 }
                  }
                  whileHover={reduced ? undefined : { y: -2, boxShadow: glow.primary }}
                  whileTap={reduced ? undefined : { scale: 0.95 }}
                  style={{
                    font: 'inherit',
                    fontSize: '0.75rem',
                    cursor: disabled ? 'default' : 'pointer',
                    padding: '4px 10px',
                    marginBottom: 4,
                    borderRadius: 'var(--hpe-radius-small)',
                    border: '1px solid var(--hpe-color-border-weak)',
                    background: 'var(--hpe-color-background-back)',
                    color: 'var(--hpe-color-text-default)',
                  }}
                >
                  {prompt}
                </motion.button>
              ))}
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      <Box direction="row" gap="xsmall" align="center">
        <Box flex>
          <TextInput
            id="copilot-composer"
            aria-label="Message the SAIP assistant"
            placeholder={disabled ? 'Waiting for a reply…' : 'Ask about an account…'}
            value={draft}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend(draft);
              }
            }}
          />
        </Box>

        <motion.button
          type="button"
          onClick={() => onSend(draft)}
          disabled={!canSend}
          aria-label="Send message"
          whileHover={canSend && !reduced ? { scale: 1.1, y: -1 } : undefined}
          whileTap={canSend && !reduced ? { scale: 0.9 } : undefined}
          animate={
            // Nudges when there's something to send, so the action is obvious.
            canSend && !reduced ? { boxShadow: glow.primary } : { boxShadow: 'none' }
          }
          transition={spring.snappy}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            flex: '0 0 auto',
            borderRadius: 'var(--hpe-radius-small)',
            border: 'none',
            cursor: canSend ? 'pointer' : 'default',
            background: canSend
              ? 'var(--hpe-color-decorative-brand)'
              : 'var(--hpe-color-background-disabled)',
          }}
        >
          <Send size="small" color={canSend ? '#ffffff' : 'icon-disabled'} />
        </motion.button>
      </Box>
    </Box>
  );
}

/**
 * The collapsed launcher.
 *
 * Idle: a slow float paired with an expanding halo, so the slot reads as live
 * without demanding attention. Hover: scales up and the icon tips. Both stop
 * entirely under reduced motion, where the button keeps its colour and shadow.
 */
function CopilotLauncher({
  open,
  reduced,
  onToggle,
}: {
  open: boolean;
  reduced: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const idle = !open && !reduced;

  return (
    /*
      IMPORTANT: the <button> itself is a fixed, transparent hit target and is
      never transformed. All the idle motion lives on the inner disc.
      Animating the button would mean the click target drifts continuously —
      which makes it materially harder to hit for anyone with a motor
      impairment, and is the kind of never-resting motion the brief warned
      against. The disc moves; the thing you aim at does not.
    */
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-expanded={open}
      aria-label={open ? 'Close SAIP assistant' : 'Open SAIP assistant'}
      style={{
        position: 'relative',
        width: 58,
        height: 58,
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Two offset halos give the pulse depth rather than one flat ring. */}
      {idle &&
        [0, 1].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            animate={{ opacity: [0.45, 0, 0.45], scale: [1, 1.55, 1] }}
            transition={{
              duration: 2.8,
              ease: easing.inOut,
              repeat: Infinity,
              delay: i * 1.4,
            }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '2px solid var(--hpe-color-decorative-brand)',
              pointerEvents: 'none',
            }}
          />
        ))}

      {/* The visible disc — this is what floats, scales and glows. */}
      <motion.span
        initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
        animate={{
          opacity: 1,
          scale: hovered && !reduced ? 1.12 : 1,
          y: idle && !hovered ? [0, -4, 0] : 0,
          boxShadow: hovered && !reduced ? glow.primary : 'var(--hpe-shadow-medium)',
        }}
        transition={
          reduced
            ? { duration: 0 }
            : {
                opacity: { duration: duration.standard, delay: 0.55 },
                scale: spring.bouncy,
                boxShadow: { duration: duration.fast },
                // The float pauses on hover, so the disc settles under the
                // cursor instead of drifting while you're looking at it.
                y:
                  idle && !hovered
                    ? { duration: 3.2, ease: easing.inOut, repeat: Infinity, delay: 1.1 }
                    : spring.snappy,
              }
        }
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          // HPE Brand green (#01a982) rather than the darker primary-strong.
          background: 'var(--hpe-color-decorative-brand)',
        }}
      >
        <motion.span
          animate={reduced ? undefined : { rotate: open ? 90 : 0 }}
          transition={spring.snappy}
          style={{ display: 'flex' }}
        >
          {/* White, explicitly: the icon-onPrimaryStrong token resolves to
              near-black (#292d3a) in light mode, which is what made the icon
              read as black on the green button. */}
          {open ? <Close color="#ffffff" /> : <Chat color="#ffffff" />}
        </motion.span>
      </motion.span>
    </button>
  );
}
