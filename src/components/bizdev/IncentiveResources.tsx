import { useRef, useState } from 'react';
import { Box, Text } from 'grommet';
import { Document, Download, Upload, View } from 'grommet-icons';
import { motion } from 'framer-motion';
import type { IncentiveResource } from '@/services';
import { duration, easing } from '@/motion/tokens';
import { useAppMotion } from '@/motion/useAppMotion';
import { formatDate } from '@/services/derive';

/**
 * Supporting documents for an incentive.
 *
 * PLACEHOLDER — nothing is uploaded, downloaded or opened. Every resource in
 * the mock data has `url: null`, and the actions below say so rather than
 * pretending: a disabled control that explains why is more honest than a live
 * one that silently does nothing, and it stops the demo implying a document
 * store exists.
 *
 * TO GO LIVE: resources become Dataverse annotations (or SharePoint documents)
 * on the incentive row. View/Download become the annotation's file URL; Upload
 * becomes a multipart POST. The picker below already collects real File objects
 * so the wiring has something to submit.
 */
export function IncentiveResources({
  resources,
  readOnly = false,
}: {
  resources: IncentiveResource[];
  /** Historical incentives are a record, not a working document. */
  readOnly?: boolean;
}) {
  const { reduced } = useAppMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string[]>([]);

  return (
    <Box gap="small">
      <Box direction="row" align="center" justify="between" gap="small" wrap>
        <Text size="small" weight={600} color="text-strong">
          Resources
        </Text>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="saip-visually-hidden"
              onChange={(event) => {
                const names = [...(event.target.files ?? [])].map((f) => f.name);
                setPending((p) => [...p, ...names]);
                // Reset so picking the same file twice still fires a change.
                event.target.value = '';
              }}
            />
            <motion.button
              type="button"
              onClick={() => inputRef.current?.click()}
              whileHover={reduced ? undefined : { y: -1 }}
              transition={{ duration: duration.fast, ease: easing.out }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                font: 'inherit',
                fontSize: '0.875rem',
                padding: '6px 12px',
                borderRadius: 'var(--hpe-radius-small)',
                border: '1px solid var(--hpe-color-border-strong)',
                background: 'transparent',
                color: 'var(--hpe-color-text-strong)',
                cursor: 'pointer',
              }}
            >
              <Upload size="small" />
              Upload PDF
            </motion.button>
          </>
        )}
      </Box>

      {resources.length === 0 && pending.length === 0 && (
        <Text size="small" color="text-weak">
          No documents attached yet.
        </Text>
      )}

      <Box gap="xsmall">
        {resources.map((resource) => (
          <ResourceRow key={resource.resourceId} resource={resource} reduced={reduced} />
        ))}

        {/* Files chosen this session. They are NOT uploaded — the row says so. */}
        {pending.map((name, i) => (
          <Box
            key={`${name}-${i}`}
            direction="row"
            align="center"
            gap="small"
            pad="small"
            round="xsmall"
            background="background-warning"
            border={{ color: 'border-warning' }}
          >
            <Document size="small" color="icon-warning" />
            <Box flex style={{ minWidth: 0 }}>
              <Text size="small" color="text-strong" truncate>
                {name}
              </Text>
              <Text size="xsmall" color="text-strong">
                Selected but not uploaded — there is no document store behind this
                prototype yet.
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ResourceRow({
  resource,
  reduced,
}: {
  resource: IncentiveResource;
  reduced: boolean;
}) {
  // Every mock resource has url: null, so both actions are unavailable. Kept in
  // the markup because their absence is the thing worth seeing.
  const unavailable = resource.url === null;
  const reason = unavailable ? 'Sample document — no file behind it yet' : undefined;

  return (
    <motion.div
      whileHover={reduced ? undefined : { x: 2 }}
      transition={{ duration: duration.fast, ease: easing.out }}
    >
      <Box
        direction="row"
        align="center"
        gap="small"
        pad="small"
        round="xsmall"
        background="background-back"
        border={{ color: 'border-weak' }}
      >
        <Document size="small" color="icon-default" />

        <Box flex style={{ minWidth: 0 }}>
          <Text size="small" color="text-strong" truncate>
            {resource.name}
          </Text>
          <Text size="xsmall" color="text-weak">
            {formatBytes(resource.sizeBytes)} · {resource.uploadedBy} ·{' '}
            {formatDate(resource.uploadedAt.slice(0, 10))}
          </Text>
        </Box>

        <Box direction="row" gap="xsmall" flex={false}>
          <IconAction label="View" title={reason} disabled={unavailable}>
            <View size="small" />
          </IconAction>
          <IconAction label="Download" title={reason} disabled={unavailable}>
            <Download size="small" />
          </IconAction>
        </Box>
      </Box>
    </motion.div>
  );
}

function IconAction({
  label,
  title,
  disabled,
  children,
}: {
  label: string;
  title?: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        padding: 0,
        borderRadius: 'var(--hpe-radius-xsmall)',
        border: '1px solid var(--hpe-color-border-weak)',
        background: 'transparent',
        color: disabled
          ? 'var(--hpe-color-text-disabled)'
          : 'var(--hpe-color-text-strong)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/** Binary-ish file sizes, one decimal. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
