/* FILES & MAP — Base Web's own examples, running under the Rocoto theme.
 *
 * Six components ship here: FileUploader, FileUploaderBasic, FixedMarker, FloatingMarker,
 * FloatingRouteMarker, LocationPuck. Every example file under bw-docs/examples/{file-uploader,
 * file-uploader-basic,fixed-marker,floating-marker,floating-route-marker,location-puck} becomes
 * one Tile — 41 of them, including the one the docs site itself never renders
 * (file-uploader-basic/_overrides_component.tsx is imported by the .mdx and then left off the
 * page; it ships anyway).
 *
 * The copy is Uber's own, verbatim — this kit is grammar, not sentences. The edits to Uber's code
 * are two, and only two:
 *   (a) docs-site-local imports become chrome or inline (their FloatingMarkerContainer is
 *       reproduced below at its own numbers, 128px tall and 16px padded);
 *   (b) each example keeps its own hooks, so each is its own function component, renamed so all
 *       forty-one can share one module.
 *
 * COLOUR: the theme re-inks. `kind={KIND.negative}` on the fixed marker stays negative here and
 * comes out INK, identical to the default kind — that is the theme working, not a bug, and it is
 * why that example ships whole. Same for the uploaders' warning/positive overrides. Where an
 * example hard-codes a colour OUTSIDE the theme's reach (`backgroundColor: "green"` on the badge
 * enhancer), or names a token PAIR the collapse flattens into one ink on another (`warning200`
 * behind `contentNegative` on the route marker, which would be ink text on an ink lozenge), the
 * value is re-sourced from the theme so the demonstration still demonstrates. Marked ↯ at each
 * site.
 *
 * THE MAP IS A PLATE, NOT MAPBOX. Five examples here (one per marker component) render inside
 * react-map-gl over live Mapbox tiles, authenticated with the access token Uber embedded in its
 * public docs. Neither travels into this reference: the token is Uber's to spend, and a page that
 * fetches tiles at paint time renders differently every time it is opened or screenshotted. So
 * the viewport is local — see MAP PLATE below, which keeps every line of those examples that
 * teaches something (the Root transform that centres a marker on its coordinate, the drag cycle
 * that feeds `dragging`, the geojson that drives both the line and the marker's midpoint) and
 * replaces only the tile source.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';

import { useStyletron } from 'baseui';

import { FileUploader, type FileRow } from 'baseui/file-uploader';
import {
  FileUploaderBasic,
  type FileUploaderBasicOverrides,
} from 'baseui/file-uploader-basic';

import {
  FixedMarker,
  FloatingMarker,
  FloatingRouteMarker,
  LocationPuck,
  KIND,
  NEEDLE_SIZES,
  PINHEAD_SIZES_SHAPES,
  BADGE_ENHANCER_SIZES,
  LABEL_ENHANCER_POSITIONS,
  FLOATING_MARKER_SIZES,
  FLOATING_MARKER_ANCHOR_TYPES,
  FLOATING_MARKER_ANCHOR_POSITIONS,
  FLOATING_ROUTE_MARKER_ANCHOR_POSITIONS,
  LOCATION_PUCK_TYPES,
  calculateFloatingRouteMarkerOffsets,
} from 'baseui/map-marker';

import { Show, Search, Upload, DeleteAlt, ChevronRight } from 'baseui/icon';

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * FILE UPLOADER — bw-docs/examples/file-uploader/*.tsx (6 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* file-uploader/basic.tsx */
function FileUploaderBasicUsage() {
  const [fileRows, setFileRows] = React.useState<Array<FileRow>>([
    {
      errorMessage: null,
      file: new File(['test file'], 'file.txt'),
      id: '0',
      progressAmount: 100,
      status: 'processed',
    },
  ]);

  const processFileOnDrop = (
    file: File
  ): Promise<{ errorMessage: string | null; fileInfo?: any }> => {
    return new Promise((resolve) => {
      // Fake an upload process for 2 seconds
      // For a real-world scenario, replace this with application upload logic
      setTimeout(() => {
        let fileInfo = {
          file,
          objectID: '1234',
          uploadID: '1234',
          uploadStatus: 'success',
        };
        resolve({ errorMessage: null, fileInfo });
      }, 2000);
    });
  };

  return (
    <FileUploader
      fileRows={fileRows}
      processFileOnDrop={processFileOnDrop}
      setFileRows={setFileRows}
    />
  );
}

/* file-uploader/item-preview.tsx */
function FileUploaderItemPreview() {
  const [fileRows, setFileRows] = React.useState<Array<FileRow>>([
    {
      errorMessage: null,
      file: new File(['test file'], 'file.txt'),
      id: '0',
      progressAmount: 100,
      status: 'processed',
    },
  ]);
  return (
    <FileUploader
      fileRows={fileRows}
      hint={
        'Try uploading a file to see the item preview. Image files will show a thumbnail.'
      }
      itemPreview
      setFileRows={setFileRows}
    />
  );
}

/* file-uploader/label-hint.tsx */
function FileUploaderLabelHint() {
  const [fileRows, setFileRows] = React.useState<Array<FileRow>>([]);
  return (
    <FileUploader
      fileRows={fileRows}
      hint={'Test hint'}
      label={'Test label'}
      setFileRows={setFileRows}
    />
  );
}

/* file-uploader/upload-restrictions.tsx */
function FileUploaderUploadRestrictions() {
  // Upload files to test restrictions. For demo purposes,
  // artificially create an array of file rows with errors.
  const [fileRows, setFileRows] = React.useState<Array<FileRow>>([
    {
      errorMessage: 'file type of img/jpeg is not accepted',
      file: new File(['test file 1'], 'unaccepted-file-type.jpeg'),
      id: '0',
      progressAmount: 20,
      status: 'error',
    },
    {
      errorMessage: 'file size must be greater than 20 KB',
      file: new File(['test file 2'], 'file-too-small.png'),
      id: '1',
      progressAmount: 20,
      status: 'error',
    },
    {
      errorMessage: 'file size must be less than 100 KB',
      file: new File(['test file 3'], 'file-too-big.png'),
      id: '2',
      progressAmount: 20,
      status: 'error',
    },
    {
      errorMessage: 'cannot process more than 3 file(s)',
      file: new File(['test file 4'], 'file-count-too-many.png'),
      id: '3',
      progressAmount: 20,
      status: 'error',
    },
  ]);

  const processFileOnDrop = (
    file: File
  ): Promise<{ errorMessage: string | null; fileInfo?: any }> => {
    return new Promise((resolve) => {
      // Fake an upload process for 2 seconds
      // For a real-world scenario, replace this with application upload logic
      setTimeout(() => {
        let fileInfo = {
          file,
          objectID: '1234',
          uploadID: '1234',
          uploadStatus: 'error',
        };
        resolve({ errorMessage: 'Custom user error', fileInfo });
      }, 2000);
    });
  };

  return (
    <FileUploader
      accept={['image/png', 'application/pdf']}
      fileRows={fileRows}
      hint={
        'Try uploading files that break these conditions: 1. accept set to ["image/png", "application/pdf"], 2. minSize set to 20000 bytes (20 KB), 3. maxSize set to 100000 bytes (100 KB), 4. maxFiles set to 3'
      }
      maxFiles={3}
      maxSize={100000}
      minSize={20000}
      processFileOnDrop={processFileOnDrop}
      setFileRows={setFileRows}
    />
  );
}

/* file-uploader/dynamic-loading.tsx */
function FileUploaderDynamicLoading() {
  const [fileRows, setFileRows] = React.useState<Array<FileRow>>([]);

  // Fake an upload process and mock the amount of time it takes each file to load
  // For a real-world scenario, replace simulateFileProgressUpdates with application upload logic
  const simulateFileProgressUpdates = (
    fileToProcess: File,
    fileToProcessId: string,
    fileRows: FileRow[],
    resolve: ({
      errorMessage,
      fileInfo,
    }: {
      errorMessage: string | null;
      fileInfo?: any;
    }) => void
  ) => {
    const fileRowsCopy: FileRow[] = [...fileRows];
    let indexOfFileToUpdate = fileRowsCopy.findIndex(
      (fileRow: FileRow) => fileRow.id === fileToProcessId
    );
    let numberOfMockedLoadingSteps = 5 - (indexOfFileToUpdate % 3);
    let mockedTotalLoadingTime = indexOfFileToUpdate % 2 === 0 ? 10000 : 8000;
    for (let i = 0; i <= numberOfMockedLoadingSteps; i++) {
      if (i === numberOfMockedLoadingSteps) {
        // Simulates an onSuccess event
        setTimeout(() => {
          resolve({ errorMessage: null });
        }, mockedTotalLoadingTime);
      } else {
        // Simulates an onLoading event
        setTimeout(
          () => {
            fileRowsCopy[indexOfFileToUpdate].progressAmount =
              (i / numberOfMockedLoadingSteps) * 100;
            setFileRows([...fileRowsCopy]);
          },
          (i / numberOfMockedLoadingSteps) * mockedTotalLoadingTime
        );
      }
    }
  };

  return (
    <FileUploader
      fileRows={fileRows}
      hint={
        'Try uploading multiple files at once to see the progress bar upload independently for each file'
      }
      processFileOnDrop={(fileToProcess, fileToProcessId, newFileRows) => {
        return new Promise((resolve) => {
          simulateFileProgressUpdates(
            fileToProcess,
            fileToProcessId,
            newFileRows,
            resolve
          );
        });
      }}
      progressAmountStartValue={0}
      setFileRows={setFileRows}
    />
  );
}

/* file-uploader/overrides.tsx */
function FileUploaderOverrides() {
  const [fileRows, setFileRows] = React.useState<Array<FileRow>>([
    {
      errorMessage: null,
      file: new File(['test file 1'], 'file-1.txt'),
      id: '0',
      progressAmount: 100,
      status: 'processed',
    },
    {
      errorMessage: 'Failed to upload',
      file: new File(['test file 2'], 'file-2.txt'),
      id: '1',
      progressAmount: 20,
      status: 'error',
    },
  ]);
  const [, theme] = useStyletron();
  return (
    <FileUploader
      fileRows={fileRows}
      setFileRows={setFileRows}
      overrides={{
        ButtonComponent: {
          props: {
            overrides: {
              BaseButton: {
                style: {
                  outline: `${theme.colors.warning} solid`,
                },
              },
            },
          },
        },
        ContentMessage: {
          style: {
            color: theme.colors.warning,
          },
        },
        FileDragAndDrop: {
          style: {
            borderColor: theme.colors.warning,
            borderStyle: 'dashed',
            borderWidth: theme.sizing.scale0,
          },
        },
        FileRows: {
          style: {
            marginLeft: theme.sizing.scale0,
            marginRight: theme.sizing.scale0,
            outline: `${theme.colors.warning} dashed`,
          },
        },
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * FILE UPLOADER BASIC — bw-docs/examples/file-uploader-basic/*.tsx (6 examples)
 *
 * Three of these examples carry byte-identical copies of Uber's useInterval helper, and two carry
 * byte-identical copies of useFakeProgress. Duplication across files is how a docs folder ships a
 * standalone snippet; inside one module it would be three names for one function. So the helper
 * is kept ONCE, and the error example's genuinely different variant is kept beside it under its
 * own name. Nothing Uber demonstrates is lost.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

// https://overreacted.io/making-setinterval-declarative-with-react-hooks/
function useInterval(callback: any, delay: number | null) {
  const savedCallback = React.useRef(() => {});

  // Remember the latest callback.
  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  React.useEffect((): any => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

// useFakeProgress is an elaborate way to show a fake file transfer for illustrative purposes. You
// don't need this is your application. Use metadata from your upload destination if it's available,
// or don't provide progress.
function useFakeProgress(): [number, () => void, () => void] {
  const [fakeProgress, setFakeProgress] = React.useState(0);
  const [isActive, setIsActive] = React.useState(false);

  function stopFakeProgress() {
    setIsActive(false);
    setFakeProgress(0);
  }

  function startFakeProgress() {
    setIsActive(true);
  }

  useInterval(
    () => {
      if (fakeProgress >= 100) {
        stopFakeProgress();
      } else {
        setFakeProgress(fakeProgress + 10);
      }
    },
    isActive ? 500 : null
  );

  return [fakeProgress, startFakeProgress, stopFakeProgress];
}

/* the error example's own variant — it stalls at 40 and raises a message instead of finishing */
function useFakeProgressWithError(): [number, string, () => void, () => void] {
  const [fakeProgress, setFakeProgress] = React.useState(0);
  const [isActive, setIsActive] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');

  function stopFakeProgress() {
    setIsActive(false);
    setErrorMessage('');
    setFakeProgress(0);
  }

  function startFakeProgress() {
    setIsActive(true);
  }

  useInterval(
    () => {
      if (fakeProgress >= 40) {
        // stopFakeProgress();
        setErrorMessage('Upload failed... connection was lost.');
      } else {
        setFakeProgress(fakeProgress + 10);
      }
    },
    isActive ? 500 : null
  );

  return [fakeProgress, errorMessage, startFakeProgress, stopFakeProgress];
}

/* file-uploader-basic/basic.tsx */
function BasicUploaderBasic() {
  const [progressAmount, startFakeProgress, stopFakeProgress] =
    useFakeProgress();

  return (
    <FileUploaderBasic
      onCancel={stopFakeProgress}
      onDrop={(acceptedFiles, rejectedFiles) => {
        // handle file upload...
        console.log(acceptedFiles, rejectedFiles);
        startFakeProgress();
      }}
      // progressAmount is a number from 0 - 100 which indicates the percent of file transfer completed
      progressAmount={progressAmount}
      progressMessage={
        progressAmount ? `Uploading... ${progressAmount}% of 100%` : ''
      }
    />
  );
}

/* file-uploader-basic/error.tsx */
function BasicUploaderError() {
  const [progressAmount, errorMessage, startFakeProgress, stopFakeProgress] =
    useFakeProgressWithError();

  return (
    <FileUploaderBasic
      errorMessage={errorMessage}
      onRetry={stopFakeProgress}
      onCancel={stopFakeProgress}
      onDrop={(acceptedFiles, rejectedFiles) => {
        // handle file upload...
        console.log(acceptedFiles, rejectedFiles);
        startFakeProgress();
      }}
      // progressAmount is a number from 0 - 100 which indicates the percent of file transfer completed
      progressAmount={progressAmount}
      progressMessage={
        progressAmount ? `Uploading... ${progressAmount}% of 100%` : ''
      }
    />
  );
}

/* file-uploader-basic/indeterminate-progress.tsx */
function BasicUploaderIndeterminate() {
  const [isUploading, setIsUploading] = React.useState(false);
  const timeoutId = React.useRef<any>();

  function reset() {
    setIsUploading(false);
    clearTimeout(timeoutId.current);
  }

  // startProgress is only illustrative. Use the progress info returned
  // from your upload endpoint. This example shows how the file-uploader-basic operates
  // if there is no progress info available.
  function startProgress() {
    setIsUploading(true);
    timeoutId.current = setTimeout(reset, 4000);
  }

  return (
    <FileUploaderBasic
      onCancel={reset}
      onDrop={(acceptedFiles, rejectedFiles) => {
        // handle file upload...
        console.log(acceptedFiles, rejectedFiles);
        startProgress();
      }}
      progressMessage={isUploading ? `Uploading... hang tight.` : ''}
    />
  );
}

/* file-uploader-basic/disabled.tsx */
function BasicUploaderDisabled() {
  return <FileUploaderBasic disabled />;
}

/* file-uploader-basic/overrides.tsx */
function BasicUploaderOverrides() {
  const [progressAmount, startFakeProgress, stopFakeProgress] =
    useFakeProgress();

  return (
    <FileUploaderBasic
      onCancel={stopFakeProgress}
      onDrop={(acceptedFiles, rejectedFiles) => {
        // handle file upload...
        console.log(acceptedFiles, rejectedFiles);
        startFakeProgress();
      }}
      // progressAmount is a number from 0 - 100 which indicates the percent of file transfer completed
      progressAmount={progressAmount}
      progressMessage={
        progressAmount ? `Uploading... ${progressAmount}% of 100%` : ''
      }
      overrides={{
        FileDragAndDrop: {
          style: (props) => ({
            borderLeftColor: props.$isDragActive
              ? props.$theme.colors.positive
              : props.$theme.colors.warning,
            borderRightColor: props.$isDragActive
              ? props.$theme.colors.positive
              : props.$theme.colors.warning,
            borderTopColor: props.$isDragActive
              ? props.$theme.colors.positive
              : props.$theme.colors.warning,
            borderBottomColor: props.$isDragActive
              ? props.$theme.colors.positive
              : props.$theme.colors.warning,
          }),
        },
        ContentMessage: {
          style: (props) => ({
            color: props.$theme.colors.warning,
          }),
        },
        ContentSeparator: {
          style: (props) => ({
            color: props.$theme.colors.warning,
          }),
        },
      }}
    />
  );
}

/* file-uploader-basic/_overrides_component.tsx
 * The docs page imports this and then never renders it. It ships here: a class component, the
 * only one in the family, taking its overrides from the outside and drawing two uploaders — a
 * clean one and one already carrying an error — off a single shared progress clock. */
class BasicUploaderOverridesComponent extends React.Component<
  { overrides: FileUploaderBasicOverrides },
  { progressAmount: number }
> {
  state = { progressAmount: 0 };
  intervalId: number = 0;

  // startProgress method is only illustrative. Use the progress info returned
  // from your upload endpoint. If unavailable, do not provide a progressAmount.
  startProgress = () => {
    this.intervalId = window.setInterval(() => {
      if (this.state.progressAmount >= 100) {
        this.reset();
      } else {
        this.setState({
          progressAmount: this.state.progressAmount + 10,
        });
      }
    }, 500);
  };

  // reset the component to its original state. use this to cancel/retry the upload.
  reset = () => {
    clearInterval(this.intervalId);
    this.setState({ progressAmount: 0 });
  };

  // ⌁ the docs snippet leaves its interval running when the component goes away. This page mounts
  //   and unmounts its sections on navigation, so the clock is stopped on the way out.
  componentWillUnmount() {
    clearInterval(this.intervalId);
  }

  render() {
    return (
      <React.Fragment>
        <FileUploaderBasic
          onCancel={this.reset}
          onDrop={() => {
            // handle file upload...
            this.startProgress();
          }}
          progressAmount={this.state.progressAmount}
          progressMessage={
            this.state.progressAmount
              ? `Uploading... ${this.state.progressAmount}% of 100%`
              : ''
          }
          overrides={this.props.overrides}
        />
        <br />
        <br />
        <FileUploaderBasic
          onCancel={this.reset}
          onDrop={() => {
            // handle file upload...
            this.startProgress();
          }}
          progressAmount={this.state.progressAmount}
          errorMessage={'Something went wrong. Sorry!'}
          progressMessage={
            this.state.progressAmount
              ? `Uploading... ${this.state.progressAmount}% of 100%`
              : ''
          }
          overrides={this.props.overrides}
        />
      </React.Fragment>
    );
  }
}

/* the overrides the docs page would have passed, had it rendered the component */
function BasicUploaderOverridesComponentDemo() {
  return (
    <BasicUploaderOverridesComponent
      overrides={{
        FileDragAndDrop: {
          style: ({ $theme }) => ({
            borderStyle: 'dashed',
            backgroundColor: $theme.colors.backgroundSecondary,
          }),
        },
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE MARKER STAGE — bw-docs/components/floating-marker-container.jsx, inlined.
 *
 * The docs site frames every floating marker, route marker and location puck in this box before
 * showing it, because a marker with a bottom anchor draws OUTSIDE its own layout box and would
 * otherwise clip. Its numbers are Uber's own literals, kept as written.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

const MarkerStage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [css] = useStyletron();
  return (
    <div
      className={css({
        height: `${128}px`,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: `${16}px`,
      })}
    >
      {children}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE MAP PLATE — the local stand-in for react-map-gl.
 *
 * `<Marker latitude longitude>` does one thing to the DOM: it puts a positioned div at the pixel
 * the map projected that coordinate to, with its top-left ON the point — which is why every one
 * of Uber's map examples then translates the marker by hand through a Root override, and why
 * those overrides are the part worth keeping. MapPoint places its child the same way, at a
 * coordinate in the plate's own 400×240 space, and each example keeps its transform verbatim.
 *
 * The ground is a neutral placeholder — water and streets, drawn from the theme, so a retheme
 * redraws the map.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

const PLATE_W = 400;
const PLATE_H = 240;

type PlateProps = {
  /** a route line in plate coordinates, drawn with the paint Uber gives the Mapbox line layer */
  line?: number[][];
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const MapPlate = React.forwardRef<HTMLDivElement, PlateProps>(function MapPlate(
  { line, children, ...rest },
  ref
) {
  const [css, theme] = useStyletron();
  return (
    <div
      ref={ref}
      {...rest}
      className={css({
        position: 'relative',
        width: '100%',
        height: `${PLATE_H}px`,
        overflow: 'hidden',
        borderRadius: theme.borders.radius200,
        backgroundColor: theme.colors.backgroundSecondary,
        touchAction: 'none',
      })}
    >
      <svg
        viewBox={`0 0 ${PLATE_W} ${PLATE_H}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        aria-hidden="true"
        className={css({ position: 'absolute', top: 0, left: 0, display: 'block' })}
      >
        {/* the water */}
        <rect
          x="0"
          y="192"
          width={PLATE_W}
          height={PLATE_H - 192}
          fill={theme.colors.backgroundTertiary}
        />
        {/* the streets */}
        <g stroke={theme.colors.backgroundPrimary} fill="none">
          <path strokeWidth="16" d="M0 96 H400" />
          <path strokeWidth="10" d="M0 40 H400" />
          <path strokeWidth="10" d="M0 150 H400" />
          <path strokeWidth="12" d="M112 0 V192" />
          <path strokeWidth="8" d="M40 0 V192" />
          <path strokeWidth="8" d="M232 0 V192" />
          <path strokeWidth="8" d="M324 0 V192" />
          {/* the road along the water */}
          <path strokeWidth="12" d="M0 192 H400" />
        </g>
        {line && (
          <polyline
            points={line.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke={theme.colors.contentPrimary}
            strokeWidth={4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
      {children}
    </div>
  );
});

/** the stand-in for react-map-gl's <Marker>: a positioned box whose top-left is ON the point */
const MapPoint: React.FC<{ x: number; y: number; children: React.ReactNode }> = ({
  x,
  y,
  children,
}) => {
  const [css] = useStyletron();
  return (
    <div
      className={css({
        position: 'absolute',
        left: `${(x / PLATE_W) * 100}%`,
        top: `${(y / PLATE_H) * 100}%`,
      })}
    >
      {children}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * FIXED MARKER — bw-docs/examples/fixed-marker/*.tsx (10 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* fixed-marker/basic.tsx */
function FixedMarkerBasic() {
  return <FixedMarker label="Uber HQ" />;
}

/* fixed-marker/start-enhancer.tsx */
function FixedMarkerStartEnhancer() {
  return (
    <FixedMarker
      label="Cloud Center"
      startEnhancer={({ size }: { size: number }) => (
        <Upload size={size} title="" />
      )}
    />
  );
}

/* fixed-marker/end-enhancer-color.tsx */
function FixedMarkerEndEnhancerColor() {
  return (
    <FixedMarker
      label="Illegal Dropoff"
      endEnhancer={({ size }: { size: number }) => (
        <DeleteAlt size={size} title="" />
      )}
      kind={KIND.negative}
    />
  );
}

/* fixed-marker/start-enhancer-large.tsx */
function FixedMarkerStartEnhancerLarge() {
  return (
    <FixedMarker
      startEnhancer={({ size }: { size: number }) => <Search size={size} />}
      size={PINHEAD_SIZES_SHAPES.large}
      needle={NEEDLE_SIZES.tall}
    />
  );
}

/* fixed-marker/dragging.tsx */
function FixedMarkerDragging() {
  const [dragging, setDragging] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setDragging(true)}
      onMouseLeave={() => setDragging(false)}
    >
      <FixedMarker
        startEnhancer={({ size }: { size: number }) => (
          <Search size={size} title="" />
        )}
        size={PINHEAD_SIZES_SHAPES.large}
        needle={NEEDLE_SIZES.short}
        label="Hover over me to view dragging state"
        dragging={dragging}
      />
    </div>
  );
}

/* fixed-marker/x-small.tsx */
function FixedMarkerXSmall() {
  return (
    <FixedMarker
      size={PINHEAD_SIZES_SHAPES.xSmallCircle}
      needle={NEEDLE_SIZES.tall}
    />
  );
}

/* fixed-marker/badge-enhancer-text.tsx */
function FixedMarkerBadgeEnhancerText() {
  // ↯ Uber hard-codes `backgroundColor: "green"` here, outside the theme's reach. The point of
  //   the example is a badge carrying a colour OTHER than its default (which is the accent, so
  //   saffron), and ink is that other colour under this theme.
  const [, theme] = useStyletron();
  return (
    <div>
      <FixedMarker
        startEnhancer={({ size }) => <Show size={size} />}
        badgeEnhancerSize={BADGE_ENHANCER_SIZES.mediumText}
        badgeEnhancerContent={() => <>New</>}
        overrides={{
          BadgeEnhancer: {
            style: {
              backgroundColor: theme.colors.backgroundInversePrimary,
            },
          },
        }}
      />
    </div>
  );
}

/* fixed-marker/badge-and-label-enhancers.tsx */
function FixedMarkerBadgeAndLabelEnhancers() {
  const [css] = useStyletron();
  return (
    <div className={css({ height: '60px' })}>
      <FixedMarker
        startEnhancer={({ size }) => <Show size={size} />}
        needle={NEEDLE_SIZES.none}
        badgeEnhancerSize={BADGE_ENHANCER_SIZES.small}
        badgeEnhancerContent={({ size }) => <Search size={size} />}
        labelEnhancerContent="Les Gourmands"
        labelEnhancerPosition={LABEL_ENHANCER_POSITIONS.bottom}
      />
    </div>
  );
}

/* fixed-marker/react-map-gl.tsx — on the plate */
const uberHq = { x: 232, y: 96 };

function FixedMarkerOnMap() {
  return (
    <MapPlate>
      <MapPoint {...uberHq}>
        <FixedMarker
          label="Uber HQ"
          overrides={{
            Root: {
              style: () => ({
                transform: `translate(-50%, -100%)`,
              }),
            },
          }}
        />
      </MapPoint>
    </MapPlate>
  );
}

/* fixed-marker/react-map-gl-dragging.tsx — on the plate, dragged for real */
function FixedMarkerDraggingOnMap() {
  const [position, setPosition] = React.useState(uberHq);
  const [dragging, setDragging] = React.useState(false);
  const plate = React.useRef<HTMLDivElement>(null);

  const onMarkerDragStart = React.useCallback((event: React.PointerEvent) => {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDragging(true);
  }, []);

  const onMarkerDrag = React.useCallback(
    (event: React.PointerEvent) => {
      if (!dragging || !plate.current) return;
      const box = plate.current.getBoundingClientRect();
      setPosition({
        x: Math.max(24, Math.min(PLATE_W - 24, ((event.clientX - box.left) / box.width) * PLATE_W)),
        y: Math.max(48, Math.min(PLATE_H - 8, ((event.clientY - box.top) / box.height) * PLATE_H)),
      });
    },
    [dragging]
  );

  const onMarkerDragEnd = React.useCallback(() => {
    setDragging(false);
  }, []);

  return (
    <MapPlate
      ref={plate}
      onPointerMove={onMarkerDrag}
      onPointerUp={onMarkerDragEnd}
      onPointerCancel={onMarkerDragEnd}
    >
      <MapPoint {...position}>
        <div onPointerDown={onMarkerDragStart} style={{ cursor: 'grab' }}>
          <FixedMarker
            label="Drag me!"
            dragging={dragging}
            overrides={{
              Root: {
                style: () => ({
                  transform: `translate(-50%, -100%)`,
                }),
              },
            }}
          />
        </div>
      </MapPoint>
    </MapPlate>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * FLOATING MARKER — bw-docs/examples/floating-marker/*.tsx (8 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* floating-marker/basic.tsx */
function FloatingMarkerBasic() {
  return <FloatingMarker label="Uber HQ" />;
}

/* floating-marker/large-top-right.tsx */
function FloatingMarkerLargeTopRight() {
  return (
    <FloatingMarker
      label="Uber HQ"
      anchor={FLOATING_MARKER_ANCHOR_POSITIONS.topRight}
      size={FLOATING_MARKER_SIZES.large}
    />
  );
}

/* floating-marker/start-enhancer.tsx */
function FloatingMarkerStartEnhancer() {
  return (
    <FloatingMarker
      label="Uber Cafe"
      anchor={FLOATING_MARKER_ANCHOR_POSITIONS.bottomRight}
      startEnhancer={({ size }: { size: number }) => (
        <Search size={size} title="" />
      )}
    />
  );
}

/* floating-marker/small-no-anchor.tsx */
function FloatingMarkerSmallNoAnchor() {
  return (
    <FloatingMarker
      label="Uber HQ"
      anchor={FLOATING_MARKER_ANCHOR_POSITIONS.none}
      size={FLOATING_MARKER_SIZES.small}
    />
  );
}

/* floating-marker/large-square-anchor-start-enhancer.tsx */
function FloatingMarkerLargeSquareAnchorStartEnhancer() {
  return (
    <FloatingMarker
      label="Uber HQ"
      anchorType={FLOATING_MARKER_ANCHOR_TYPES.square}
      startEnhancer={({ size }: { size: number }) => (
        <Search size={size} title="" />
      )}
      size={FLOATING_MARKER_SIZES.large}
    />
  );
}

/* floating-marker/secondary-label.tsx */
function FloatingMarkerSecondaryLabel() {
  return (
    <FloatingMarker
      size={FLOATING_MARKER_SIZES.large}
      label="Uber HQ"
      secondaryLabel="Mission Bay 3"
    />
  );
}

/* floating-marker/secondary-label-color.tsx */
function FloatingMarkerSecondaryLabelColor() {
  return (
    <FloatingMarker
      size={FLOATING_MARKER_SIZES.medium}
      label="Pickup"
      secondaryLabel="Mission Bay 3"
      overrides={{
        Label: {
          style: ({ $theme }) => ({
            color: $theme.colors.contentTertiary,
          }),
        },
      }}
    />
  );
}

/* floating-marker/react-map-gl.tsx — on the plate */
function FloatingMarkerOnMap() {
  return (
    <MapPlate>
      <MapPoint {...uberHq}>
        <FloatingMarker
          label="Uber HQ"
          overrides={{
            Root: {
              style: () => ({
                transform: `translate(-50%, -50%)`,
              }),
            },
          }}
        />
      </MapPoint>
    </MapPlate>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * FLOATING ROUTE MARKER — bw-docs/examples/floating-route-marker/*.tsx (6 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* floating-route-marker/basic.tsx
 * Uber's own basic.tsx for this component renders a FloatingMarker, not a FloatingRouteMarker —
 * so the docs site shows a floating marker under «Floating Route Marker · Basic usage». Shipped
 * as written; the Tile says what it is. */
function RouteMarkerBasic() {
  return <FloatingMarker label="Uber HQ" />;
}

/* floating-route-marker/secondary-label.tsx */
function RouteMarkerSecondaryLabel() {
  return <FloatingRouteMarker label="57 min" secondaryLabel="Fastest route" />;
}

/* floating-route-marker/start-end-enhancer.tsx */
function RouteMarkerStartEndEnhancer() {
  return (
    <FloatingRouteMarker
      label="Avoids tolls"
      startEnhancer={({ size }) => <Search size={size} title="" />}
      endEnhancer={({ size }) => <ChevronRight size={size} title="" />}
    />
  );
}

/* floating-route-marker/custom-color-overrides.tsx */
function RouteMarkerCustomColorOverrides() {
  const [css] = useStyletron();
  return (
    <div
      className={css({
        height: `${128}px`,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        padding: `${16}px`,
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <FloatingRouteMarker
          label="I'm unselected!"
          secondaryLabel="Avoids tolls"
          overrides={{
            Root: {
              // ↯ Uber names warning200 behind a contentNegative label. This theme collapses
              //   warning and negative onto ink, so that pair would be ink text on an ink
              //   lozenge. Re-sourced to a surface and a label the theme keeps apart, which is
              //   what the example is here to show: both can be overridden.
              style: ({ $theme }) => ({
                backgroundColor: $theme.colors.backgroundTertiary,
              }),
            },
            Pointer: {
              style: ({ $theme }) => ({
                fill: $theme.colors.backgroundTertiary,
              }),
            },
            Label: {
              style: ({ $theme }) => ({
                color: $theme.colors.contentTertiary,
              }),
            },
          }}
        />
      </div>
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <FloatingRouteMarker
          label="I'm selected!"
          secondaryLabel="Secondary label with a custom color"
          selected={true}
          overrides={{
            Root: {
              style: ({ $theme }) => ({
                backgroundColor: $theme.colors.backgroundAccent,
              }),
            },
            Pointer: {
              style: ({ $theme }) => ({
                fill: $theme.colors.backgroundAccent,
              }),
            },
            SecondaryLabel: {
              style: ({ $theme }) => ({
                color: $theme.colors.contentOnColor,
              }),
            },
          }}
        />
      </div>
    </div>
  );
}

/* floating-route-marker/changing-pointer-positions.tsx */
const anchors = [
  FLOATING_ROUTE_MARKER_ANCHOR_POSITIONS.topLeft,
  FLOATING_ROUTE_MARKER_ANCHOR_POSITIONS.topCenter,
  FLOATING_ROUTE_MARKER_ANCHOR_POSITIONS.topRight,
  FLOATING_ROUTE_MARKER_ANCHOR_POSITIONS.rightCenter,
  FLOATING_ROUTE_MARKER_ANCHOR_POSITIONS.bottomRight,
  FLOATING_ROUTE_MARKER_ANCHOR_POSITIONS.bottomCenter,
  FLOATING_ROUTE_MARKER_ANCHOR_POSITIONS.bottomLeft,
  FLOATING_ROUTE_MARKER_ANCHOR_POSITIONS.leftCenter,
];

function RouteMarkerChangingPointerPositions() {
  const [css] = useStyletron();
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => {
      setIndex((t) => {
        if (t >= anchors.length - 1) {
          return 0;
        } else {
          return t + 1;
        }
      });
    }, 3000);
    // ⌁ the docs snippet never clears this. This page mounts and unmounts its sections on
    //   navigation, so the clock is stopped on the way out.
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={css({
        height: `${200}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <div className={css({ position: 'absolute' })}>
        <FloatingRouteMarker
          label={`${anchors[index]}`}
          secondaryLabel="I change every 3 sec"
          anchorPosition={anchors[index]}
          overrides={{
            Root: {
              style: () => ({
                transform: calculateFloatingRouteMarkerOffsets(anchors[index]),
              }),
            },
          }}
        />
      </div>
    </div>
  );
}

/* floating-route-marker/react-map-gl.tsx — on the plate.
 * Uber's example builds a geojson LineString, hands it to a Mapbox line layer, and puts the
 * marker on the midpoint it calculates from the very same coordinates. That is kept whole: the
 * line below draws the plate's route AND locates the marker. */
function calculateMidpoint([[x1, y1], [x2, y2]]: number[][]) {
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

const geojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [56, 200],
          [324, 52],
        ],
      },
    },
  ],
};

function RouteMarkerOnMap() {
  const midpoint = calculateMidpoint(geojson.features[0].geometry.coordinates);
  return (
    <MapPlate line={geojson.features[0].geometry.coordinates}>
      <MapPoint x={midpoint[0]} y={midpoint[1]}>
        <FloatingRouteMarker
          label="El Morro Path"
          anchorPosition={FLOATING_ROUTE_MARKER_ANCHOR_POSITIONS.bottomLeft}
          overrides={{
            Root: {
              style: () => ({
                transform: calculateFloatingRouteMarkerOffsets(
                  FLOATING_ROUTE_MARKER_ANCHOR_POSITIONS.bottomLeft,
                  4
                ),
              }),
            },
          }}
        />
      </MapPoint>
    </MapPlate>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * LOCATION PUCK — bw-docs/examples/location-puck/*.tsx (5 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* location-puck/consumer.tsx */
function LocationPuckConsumer() {
  return <LocationPuck type={LOCATION_PUCK_TYPES.consumer} />;
}

/* location-puck/consumer-confidence.tsx */
function LocationPuckConsumerConfidence() {
  return (
    <LocationPuck type={LOCATION_PUCK_TYPES.consumer} confidenceRadius={120} />
  );
}

/* location-puck/consumer-no-heading.tsx */
function LocationPuckConsumerNoHeading() {
  return (
    <LocationPuck type={LOCATION_PUCK_TYPES.consumer} showHeading={false} />
  );
}

/* location-puck/earner.tsx */
function LocationPuckEarner() {
  return <LocationPuck type={LOCATION_PUCK_TYPES.earner} />;
}

/* location-puck/react-map-gl.tsx — on the plate */
function LocationPuckOnMap() {
  return (
    <MapPlate>
      <MapPoint x={168} y={132}>
        <LocationPuck
          confidenceRadius={120}
          overrides={{
            Root: {
              style: () => ({
                transform: `translate(-50%, -50%)`,
              }),
            },
          }}
        />
      </MapPoint>
    </MapPlate>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PAGE
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

export default function FilesMapSection() {
  return (
    <>
      <Section
        t="File Uploader"
        n="Use it to take files by drag-and-drop or the system Browse files dialog, giving every file its own row, its own progress and its own result."
      >
        <Grid>
          <Tile
            name="Basic usage"
            rule="processFileOnDrop resolves { errorMessage } per file; the row carries the outcome"
            span={6}
          >
            <FileUploaderBasicUsage />
          </Tile>
          <Tile
            name="Item preview"
            rule="itemPreview draws a thumbnail for images and a paperclip for the rest"
            span={6}
          >
            <FileUploaderItemPreview />
          </Tile>
          <Tile
            name="Label and hint"
            rule="label sits above the dropzone, hint below it"
            span={6}
          >
            <FileUploaderLabelHint />
          </Tile>
          <Tile
            name="Upload restrictions"
            rule="accept, minSize, maxSize and maxFiles raise their own row errors before anything uploads"
            span={6}
          >
            <FileUploaderUploadRestrictions />
          </Tile>
          <Tile
            name="Dynamic loading"
            rule="progressAmountStartValue + per-row progressAmount: each bar advances on its own clock"
            span={6}
          >
            <FileUploaderDynamicLoading />
          </Tile>
          <Tile
            name="Overrides"
            rule="Uber's outlines name colors.warning; this theme inks it — colour is not a status system"
            span={6}
          >
            <FileUploaderOverrides />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="File Uploader Basic"
        n="Use it to take files by drag-and-drop or the system Browse files dialog, with one progress line covering the whole transfer."
      >
        <Grid>
          <Tile
            name="File uploader basic usage"
            rule="progressAmount 0–100 draws the bar; progressMessage says it in words"
            span={6}
          >
            <BasicUploaderBasic />
          </Tile>
          <Tile
            name="File upload basic with error"
            rule="errorMessage swaps Cancel for Retry"
            span={6}
          >
            <BasicUploaderError />
          </Tile>
          <Tile
            name="File upload basic with unknown progress"
            rule="progressMessage without progressAmount gives the spinner instead of a bar"
            span={6}
          >
            <BasicUploaderIndeterminate />
          </Tile>
          <Tile name="File uploader basic in disabled state" span={6}>
            <BasicUploaderDisabled />
          </Tile>
          <Tile
            name="File uploader basic with overrides"
            rule="$isDragActive swaps positive for warning; both are ink here, so the border holds still"
            span={6}
          >
            <BasicUploaderOverrides />
          </Tile>
          <Tile
            name="Overrides component"
            rule="imported by the docs page, never rendered on it — two uploaders on one progress clock"
            span={6}
          >
            <BasicUploaderOverridesComponentDemo />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Fixed Marker"
        n="Use it to mark a specific point on a map — a pin pushed into a wallmap — including the draggable kind a person moves to set a location."
      >
        <Grid>
          <Tile name="Basic usage with label" rule="default size medium, needle medium" span={4}>
            <FixedMarkerBasic />
          </Tile>
          <Tile name="Start enhancer with label" span={4}>
            <FixedMarkerStartEnhancer />
          </Tile>
          <Tile
            name="End enhancer with custom color"
            rule="kind=negative, kept as Uber wrote it; this theme inks it, so it matches the default kind"
            span={4}
          >
            <FixedMarkerEndEnhancerColor />
          </Tile>
          <Tile
            name="Large size with only an icon"
            rule="a pinhead with no label carries exactly one icon"
            span={4}
          >
            <FixedMarkerStartEnhancerLarge />
          </Tile>
          <Tile name="Dragging state" rule="hover the marker" span={4}>
            <FixedMarkerDragging />
          </Tile>
          <Tile
            name="X small marker"
            rule="the same anchor the Floating Marker uses"
            span={4}
          >
            <FixedMarkerXSmall />
          </Tile>
          <Tile
            name="Marker with a badge enhancer with text"
            rule="↯ Uber's badge is hard-coded green, outside the theme; re-sourced to ink"
            span={4}
          >
            <FixedMarkerBadgeEnhancerText />
          </Tile>
          <Tile
            name="Marker with a small badge enhancer and a label enhancer"
            rule="badge on the pinhead, label enhancer underneath"
            span={4}
          >
            <FixedMarkerBadgeAndLabelEnhancers />
          </Tile>
          <Tile
            name="Usage with react-map-gl"
            rule="on the local plate; the Root transform that centres the marker on its coordinate is Uber's own"
            span={6}
          >
            <FixedMarkerOnMap />
          </Tile>
          <Tile
            name="Draggable marker with react-map-gl"
            rule="drag it — the drag cycle feeds the dragging prop and the new position"
            span={6}
          >
            <FixedMarkerDraggingOnMap />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Floating Marker"
        n="Use it for map content that moves or repositions itself — a pickup point, or a marker riding along a route line."
      >
        <Grid>
          <Tile name="Basic usage with label" rule="default size medium" span={4}>
            <MarkerStage>
              <FloatingMarkerBasic />
            </MarkerStage>
          </Tile>
          <Tile name="Large marker with top right anchor position" span={4}>
            <MarkerStage>
              <FloatingMarkerLargeTopRight />
            </MarkerStage>
          </Tile>
          <Tile name="Start enhancer" rule="anchor bottom right" span={4}>
            <MarkerStage>
              <FloatingMarkerStartEnhancer />
            </MarkerStage>
          </Tile>
          <Tile name="Small marker with no anchor" span={4}>
            <MarkerStage>
              <FloatingMarkerSmallNoAnchor />
            </MarkerStage>
          </Tile>
          <Tile
            name="Large square anchor with start enhancer"
            rule="size large sizes the icon too"
            span={4}
          >
            <MarkerStage>
              <FloatingMarkerLargeSquareAnchorStartEnhancer />
            </MarkerStage>
          </Tile>
          <Tile
            name="Two labels"
            rule="secondaryLabel drops the type one step; large and medium only"
            span={4}
          >
            <MarkerStage>
              <FloatingMarkerSecondaryLabel />
            </MarkerStage>
          </Tile>
          <Tile name="Two labels with custom color" span={4}>
            <MarkerStage>
              <FloatingMarkerSecondaryLabelColor />
            </MarkerStage>
          </Tile>
          <Tile
            name="Usage with react-map-gl"
            rule="on the local plate; translate(-50%, -50%) centres a floating marker on its coordinate"
            span={6}
          >
            <FloatingMarkerOnMap />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Floating Route Marker"
        n="Use it to annotate a route line on a map, such as labelling a choice of routes before navigation starts."
      >
        <Grid>
          <Tile
            name="Basic usage"
            rule="Uber's own basic.tsx renders a FloatingMarker here — shipped as written"
            span={4}
          >
            <MarkerStage>
              <RouteMarkerBasic />
            </MarkerStage>
          </Tile>
          <Tile name="Primary and secondary labels" span={4}>
            <MarkerStage>
              <RouteMarkerSecondaryLabel />
            </MarkerStage>
          </Tile>
          <Tile name="Start and end enhancers" span={4}>
            <MarkerStage>
              <RouteMarkerStartEndEnhancer />
            </MarkerStage>
          </Tile>
          <Tile
            name="Custom color overrides"
            rule="unselected left, selected right; the Pointer takes fill, not backgroundColor — it is an SVG"
            span={12}
          >
            <RouteMarkerCustomColorOverrides />
          </Tile>
          <Tile
            name="Changing pointer positions"
            rule="all eight anchor positions, three seconds each; the label IS the position"
            span={6}
          >
            <RouteMarkerChangingPointerPositions />
          </Tile>
          <Tile
            name="Usage with react-map-gl"
            rule="on the local plate; one geojson LineString draws the route AND places the marker on its midpoint"
            span={6}
          >
            <RouteMarkerOnMap />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Location Puck"
        n="Use it for the person's own current location on a map, and keep it for exactly that."
      >
        <Grid>
          <Tile
            name="Consumer location puck"
            rule="for map views in consumer apps"
            span={4}
          >
            <MarkerStage>
              <LocationPuckConsumer />
            </MarkerStage>
          </Tile>
          <Tile
            name="Consumer location puck with confidence level"
            rule="confidenceRadius draws how sure the fix is"
            span={4}
          >
            <MarkerStage>
              <LocationPuckConsumerConfidence />
            </MarkerStage>
          </Tile>
          <Tile
            name="Consumer location puck with no heading indicator"
            rule="showHeading=false, for desktop, where heading is a guess"
            span={4}
          >
            <MarkerStage>
              <LocationPuckConsumerNoHeading />
            </MarkerStage>
          </Tile>
          <Tile
            name="Earner location puck"
            rule="for navigation — overview and turn-by-turn"
            span={4}
          >
            <MarkerStage>
              <LocationPuckEarner />
            </MarkerStage>
          </Tile>
          <Tile
            name="Usage with react-map-gl"
            rule="on the local plate, confidence radius and all"
            span={6}
          >
            <LocationPuckOnMap />
          </Tile>
        </Grid>
      </Section>
    </>
  );
}
