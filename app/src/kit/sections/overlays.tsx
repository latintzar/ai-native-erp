/* OVERLAYS — Base Web's own examples, running under the Rocoto theme.
 *
 * Five components ship here: Modal, Dialog, Drawer, Popover, Tooltip. Every example file under
 * bw-docs/examples/{modal,dialog,drawer,popover,tooltip} becomes one Tile — 23 of them, including
 * the three the docs pages themselves never list (popover/clipping.tsx, popover/overrides.tsx and
 * popover/ssr-render-all.tsx are all in popover.mdx; drawer/ssr-render-all.tsx is in drawer.mdx —
 * so in this family the folder and the page agree, and all 23 ship).
 *
 * The demo copy is Uber's own, verbatim — this kit is grammar, not sentences, so an example says
 * exactly what the docs example says and pre-decides nothing about where the control belongs. The
 * edits to Uber's code are two, and only two:
 *   (a) docs-site-local imports become chrome or inline;
 *   (b) each example keeps its own hooks and state, so each is its own function component, renamed
 *       so all twenty-three can share one module.
 *
 * COLOUR: the theme re-inks. popover/overrides.tsx asks for `$theme.colors.warning` on the arrow,
 * the body and the inner — that prop stays exactly as Uber wrote it, and it comes out INK, because
 * colour is not a status system here. That is the theme working, and it is why the overrides demo
 * ships whole. Where a value sits OUTSIDE the theme's reach the value is re-sourced from the theme
 * and marked ↯:
 *   · popover/clipping.tsx hard-codes a literal grey as the scroll box's `backgroundColor`;
 *   · dialog/with-background-image.tsx imports a 1.6 MB photograph of Venice out of the docs
 *     folder — a docs-site-local import, so the artwork becomes the one texture Rocoto supplies:
 *     the dotted paper, on the theme's inverse ground;
 *   · tooltip/stateful-complex-content.tsx wraps its contents in Base's stock `DarkTheme`, a
 *     SECOND theme object that bypasses Rocoto's entirely, so that one snippet would come out in
 *     Base's own typeface while the rest of the page is in Rocoto's. Uber's structure is the point
 *     of the example (give the content a theme so it reads on the tooltip's dark ground), so the
 *     structure stays and the theme is built here from `createDarkTheme`, taking its typography
 *     straight off RocotoTheme so there is one type source on the page.
 *
 * TYPING: three examples were written before the docs site type-checked its examples folder —
 * drawer/sizes.tsx maps `Object.keys(SIZE)` (string) into a `size` prop, drawer/anchors.tsx
 * annotates its anchor `: string`, and both render a `<React.Fragment>` per iteration with no
 * `key`. The map types are narrowed and the keys added. Behaviour is untouched.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';

import { useStyletron, ThemeProvider, createDarkTheme } from 'baseui';
import { Button, KIND } from 'baseui/button';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalButton,
  FocusOnce,
} from 'baseui/modal';
import { Dialog, SIZE as DIALOG_SIZE } from 'baseui/dialog';
import { Drawer, ANCHOR, SIZE as DRAWER_SIZE } from 'baseui/drawer';
import { Popover, StatefulPopover, PLACEMENT, TRIGGER_TYPE } from 'baseui/popover';
import { StatefulTooltip } from 'baseui/tooltip';
import { StatefulCheckbox } from 'baseui/checkbox';
import { StyledLink } from 'baseui/link';
import { ParagraphSmall, LabelSmall } from 'baseui/typography';

import { RocotoTheme, rocoto, dots, DOT_TILE } from '../../rocoto-theme';

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * MODAL — bw-docs/examples/modal/*.tsx (5 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* modal/basic.tsx */
function ModalBasic() {
  const [isOpen, setIsOpen] = React.useState(false);

  function close() {
    setIsOpen(false);
  }

  return (
    <React.Fragment>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal onClose={close} isOpen={isOpen}>
        <ModalHeader>Hello world</ModalHeader>
        <ModalBody>
          Proin ut dui sed metus pharetra hend rerit vel non mi. Nulla ornare faucibus ex, non
          facilisis nisl. Maecenas aliquet mauris ut tempus.
        </ModalBody>
        <ModalFooter>
          <ModalButton kind="tertiary" onClick={close}>
            Cancel
          </ModalButton>
          <ModalButton onClick={close}>Okay</ModalButton>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
}

/* modal/autofocus.tsx */
function ModalAutoFocus() {
  const [isOpen, setOpen] = React.useState(false);
  return (
    <React.Fragment>
      <Button onClick={() => setOpen((s) => !s)}>Open Modal</Button>
      <Modal onClose={() => setOpen(false)} isOpen={isOpen}>
        <FocusOnce>
          <ModalHeader>Some Header</ModalHeader>
        </FocusOnce>
        <ModalBody>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas quam nisl, tempor ut
            varius sit amet, sodales sit amet mauris. Aliquam vitae sapien quis eros finibus
            aliquet.
          </p>
        </ModalBody>
        <ModalFooter>
          <ModalButton kind="tertiary" onClick={() => setOpen(false)}>
            Close
          </ModalButton>
          <ModalButton autoFocus onClick={() => setOpen(false)}>
            Confirm
          </ModalButton>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
}

/* modal/sized.tsx — a combination of overrides and in-line styles: the Dialog is 80vw × 80vh and a
 * column flex container, and the ModalBody takes `flex: 1 1 0` so header and footer keep their
 * places. */
function ModalSized() {
  const [isOpen, setIsOpen] = React.useState(false);

  function close() {
    setIsOpen(false);
  }

  return (
    <React.Fragment>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal
        onClose={close}
        isOpen={isOpen}
        overrides={{
          Dialog: {
            style: {
              width: '80vw',
              height: '80vh',
              display: 'flex',
              flexDirection: 'column',
            },
          },
        }}
      >
        <ModalHeader>Hello world</ModalHeader>
        <ModalBody style={{ flex: '1 1 0' }}>
          Proin ut dui sed metus pharetra hend rerit vel non mi. Nulla ornare faucibus ex, non
          facilisis nisl. Maecenas aliquet mauris ut tempus.
        </ModalBody>
        <ModalFooter>
          <ModalButton kind="tertiary" onClick={close}>
            Cancel
          </ModalButton>
          <ModalButton onClick={close}>Okay</ModalButton>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
}

/* modal/buried-interactive-element.tsx — the modal's first interactive element (the footer button)
 * sits under five paragraphs of content. WAI-ARIA asks that focus land on a normally non-focusable
 * element at the top instead of skipping the content, which is what FocusOnce around the header
 * does. The five paragraphs are Uber's own, and their length is the demonstration: they are what
 * buries the button. */
function ModalBuriedInteractiveElement() {
  const [isOpen, setOpen] = React.useState(false);
  return (
    <React.Fragment>
      <Button onClick={() => setOpen((s) => !s)}>Open Modal</Button>
      <Modal onClose={() => setOpen(false)} isOpen={isOpen}>
        <FocusOnce>
          <ModalHeader>Some Header</ModalHeader>
        </FocusOnce>
        <ModalBody>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas quam nisl, tempor ut
            varius sit amet, sodales sit amet mauris. Aliquam vitae sapien quis eros finibus
            aliquet. Fusce et quam lobortis, viverra eros eget, finibus leo. Integer elementum lacus
            et lorem suscipit tincidunt. Proin malesuada turpis id mi placerat maximus a et diam.
            Sed elementum cursus metus, in imperdiet sapien commodo non. Pellentesque ultricies
            lorem nulla, a finibus eros fermentum viverra. Cras nulla lacus, porttitor quis euismod
            sed, varius sit amet magna. Ut aliquam odio sed ultricies eleifend. Etiam quis velit
            odio. Aenean fermentum dolor sit amet pellentesque facilisis. Aliquam porta in risus nec
            faucibus.
          </p>
          <p>
            Proin rhoncus pharetra purus. Aliquam sapien est, ultrices vitae velit ac, dictum
            volutpat sem. Morbi blandit venenatis volutpat. Sed finibus bibendum justo faucibus
            tempor. Nunc commodo condimentum magna et auctor. Nunc consequat turpis eget rutrum
            aliquet. Mauris fringilla libero non urna volutpat lacinia. Sed facilisis finibus
            lobortis. Etiam ipsum erat, euismod eget purus id, dignissim faucibus velit. Fusce
            rutrum urna felis, consequat ullamcorper dolor porttitor vitae. Nulla non velit eget
            urna congue congue ac vitae lorem. Sed ac lorem eu justo consectetur varius placerat sit
            amet enim. Curabitur eu placerat augue, ut porttitor quam. Vivamus vitae elit eu nisl
            rutrum sodales ut eu nisl. Praesent elementum orci sed metus vulputate blandit.
          </p>
          <p>
            In vel condimentum quam, eget dignissim velit. Pellentesque volutpat urna in eros
            tempor, vestibulum accumsan enim suscipit. Morbi condimentum placerat dolor, et ultrices
            elit accumsan quis. Nam laoreet auctor felis at lobortis. Nulla fringilla, elit ut
            sollicitudin fermentum, velit metus porta massa, nec pharetra justo leo a purus. Duis
            pharetra est interdum neque viverra, eget ultrices dui efficitur. In sed orci dolor. In
            hac habitasse platea dictumst. Proin aliquam facilisis eros, a mollis ante consequat
            vitae. Fusce quis viverra est. Sed tristique accumsan magna, vel dictum lectus posuere
            at. Suspendisse at scelerisque diam.
          </p>
          <p>
            Donec sem ante, pulvinar ac turpis laoreet, euismod semper massa. Donec finibus
            fringilla augue, ac suscipit diam placerat eget. Lorem ipsum dolor sit amet, consectetur
            adipiscing elit. Nam pulvinar ultricies est, ut laoreet tortor pulvinar pretium. Nam
            imperdiet feugiat sodales. Sed posuere nisi vel ex euismod, in tristique metus sodales.
            Duis laoreet quam at molestie euismod. Nulla tempus sagittis tortor ac porttitor. Proin
            suscipit pharetra eros vitae rutrum.
          </p>
          <p>
            Etiam eu orci faucibus, molestie turpis sed, feugiat eros. Aliquam quis orci eget tellus
            convallis cursus eu non ante. Praesent et sagittis odio, nec mollis metus. Mauris
            suscipit sapien eu nulla vehicula mollis. Integer sapien ex, consequat vel ornare
            mollis, laoreet hendrerit tortor. Vestibulum a lacus vel nisl volutpat mattis. Vivamus
            tincidunt gravida risus a viverra. Maecenas varius ligula ac blandit tempus. Nulla
            facilisi. Fusce blandit, purus in malesuada blandit, enim velit pretium est, vel
            faucibus nisl dui blandit felis. Nullam sit amet dapibus sapien, bibendum suscipit orci.
            Suspendisse gravida mauris justo, pulvinar condimentum augue egestas eu. Etiam dictum
            felis eros, sed dapibus orci malesuada sed.
          </p>
        </ModalBody>
        <ModalFooter>
          <ModalButton onClick={() => setOpen(false)}>Okay</ModalButton>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
}

/* modal/nested.tsx — Uber's own render-prop class container, kept as written; it is what makes the
 * second modal's state live outside the first. */
interface NestedProps {
  children: (args: {
    isConfirmationOpen: boolean;
    toggleConfirm: (open?: boolean, cb?: () => any) => any;
  }) => React.ReactNode;
}

interface NestedState {
  isConfirmationOpen: boolean;
}

class ModalStateContainer extends React.Component<NestedProps, NestedState> {
  state = {
    isConfirmationOpen: false,
  };
  toggleConfirm = (open = !this.state.isConfirmationOpen, cb: () => any = () => {}) => {
    this.setState({ isConfirmationOpen: open }, cb);
  };
  render() {
    return this.props.children({
      isConfirmationOpen: this.state.isConfirmationOpen,
      toggleConfirm: this.toggleConfirm,
    });
  }
}

function ModalNested() {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <ModalStateContainer>
      {({ isConfirmationOpen, toggleConfirm }) => (
        <React.Fragment>
          <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
          <Modal onClose={() => setIsOpen(false)} isOpen={isOpen}>
            <ModalHeader>Hello world</ModalHeader>
            <ModalBody>
              Proin ut dui sed metus pharetra hend rerit vel non mi. Nulla ornare faucibus ex, non
              facilisis nisl. Maecenas aliquet mauris ut tempus.
            </ModalBody>
            <ModalFooter>
              <ModalButton kind="tertiary" onClick={() => setIsOpen(false)}>
                Cancel
              </ModalButton>
              <ModalButton onClick={() => toggleConfirm(true)}>Okay</ModalButton>
            </ModalFooter>
          </Modal>
          <Modal onClose={() => toggleConfirm(false)} isOpen={isConfirmationOpen}>
            <ModalHeader>Confirm</ModalHeader>
            <ModalBody>Confirm closing all.</ModalBody>
            <ModalFooter>
              <ModalButton kind="tertiary" onClick={() => toggleConfirm(false)}>
                No
              </ModalButton>
              <ModalButton
                onClick={() => {
                  toggleConfirm(false, () => setIsOpen(false));
                }}
              >
                Yes
              </ModalButton>
            </ModalFooter>
          </Modal>
        </React.Fragment>
      )}
    </ModalStateContainer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * DIALOG — bw-docs/examples/dialog/*.tsx (2 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* dialog/without-overlay.tsx — with `hasOverlay={false}` the Dialog behaves as a popup rather than
 * a modal, and `numHeadingLines={1}` truncates the heading to a single line. */
function DialogWithoutOverlay() {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <div>
      <div>
        <Button
          onClick={() => {
            setIsOpen(!isOpen);
          }}
        >
          Open
        </Button>
      </div>
      <Dialog
        heading="This is the heading"
        numHeadingLines={1}
        size={DIALOG_SIZE.medium}
        hasOverlay={false}
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
        buttonDock={{
          primaryAction: <Button>Primary Action</Button>,
          dismissiveAction: <Button kind={KIND.tertiary}>Dismiss</Button>,
          secondaryActions: [
            <Button kind={KIND.secondary} key="first">
              Secondary Action
            </Button>,
          ],
        }}
      >
        <p>
          At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium
          voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati
          cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id
          est laborum et dolorum fuga.
        </p>
      </Dialog>
    </div>
  );
}

/* dialog/with-background-image.tsx — the `artwork` prop takes a component or a rendered element.
 * ↯ Uber's artwork is a 1.6 MB photograph of Venice imported from the docs folder — a
 * docs-site-local import. It becomes the one texture Rocoto supplies: the dotted paper on the
 * theme's inverse ground. The artwork stays decorative, so it stays a background-image exactly as
 * Uber's note explains; semantic artwork would be an img element. */
const BackgroundArtwork: React.FC = () => {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        width: '100%',
        height: '200px',
        backgroundImage: dots(theme.colors.contentInverseSecondary),
        backgroundSize: DOT_TILE,
        backgroundPosition: 'center',
        backgroundColor: theme.colors.backgroundInversePrimary,
      }}
    ></div>
  );
};

function DialogWithBackgroundImage() {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <div>
      <div>
        <Button
          onClick={() => {
            setIsOpen(!isOpen);
          }}
        >
          Open
        </Button>
      </div>
      <Dialog
        artwork={BackgroundArtwork}
        heading="Heading"
        size={DIALOG_SIZE.medium}
        hasOverlay={true}
        isOpen={isOpen}
        onDismiss={() => setIsOpen(false)}
        buttonDock={{
          primaryAction: <Button>Primary Action</Button>,
          dismissiveAction: (
            <Button onClick={() => setIsOpen(false)} kind={KIND.tertiary}>
              Dismiss
            </Button>
          ),
          secondaryActions: [
            <Button kind={KIND.secondary} key="first">
              Secondary Action
            </Button>,
          ],
        }}
      >
        <p>
          Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id
          quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor
          repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus
          saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum
          rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias
          consequatur aut perferendis doloribus asperiores repellat.
        </p>
      </Dialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * DRAWER — bw-docs/examples/drawer/*.tsx (3 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* drawer/anchors.tsx — one drawer per ANCHOR value; the trigger's label is the anchor being
 * demonstrated. */
function DrawerAnchors() {
  let initialState: { [key: string]: boolean } = {};
  for (let anchor in ANCHOR) {
    initialState[anchor] = false;
  }
  const [isOpen, setIsOpen] = React.useState(initialState);

  function close(anchorType: string) {
    setIsOpen({ ...isOpen, [anchorType]: false });
  }

  return (
    <React.Fragment>
      {Object.values(ANCHOR).map((eachAnchor) => (
        <React.Fragment key={eachAnchor}>
          <Button
            onClick={() => setIsOpen({ ...isOpen, [eachAnchor]: true })}
            overrides={{
              BaseButton: {
                style: {
                  marginTop: '12px',
                  marginBottom: '12px',
                  marginLeft: '12px',
                  marginRight: '12px',
                },
              },
            }}
          >
            Open Drawer on {eachAnchor}
          </Button>
          <Drawer
            onClose={() => close(eachAnchor)}
            isOpen={isOpen[eachAnchor]}
            anchor={eachAnchor}
          >
            Proin ut dui sed metus pharetra hend rerit vel non mi. Nulla ornare faucibus ex, non
            facilisis nisl. Maecenas aliquet mauris ut tempus.
          </Drawer>
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

/* drawer/sizes.tsx — one drawer per SIZE value: default is 500px, full is 100%, auto hugs its
 * content; the trigger's label is the size being demonstrated. */
function DrawerSizes() {
  let initialState: { [key: string]: boolean } = {};
  for (let size in DRAWER_SIZE) {
    initialState[size] = false;
  }
  const [isOpen, setIsOpen] = React.useState(initialState);

  function close(sizeType: string) {
    setIsOpen({ ...isOpen, [sizeType]: false });
  }

  return (
    <React.Fragment>
      {(Object.keys(DRAWER_SIZE) as Array<keyof typeof DRAWER_SIZE>).map((eachSize) => (
        <React.Fragment key={eachSize}>
          <Button
            onClick={() => setIsOpen({ ...isOpen, [eachSize]: true })}
            overrides={{
              BaseButton: {
                style: {
                  marginTop: '12px',
                  marginBottom: '12px',
                  marginLeft: '12px',
                  marginRight: '12px',
                },
              },
            }}
          >
            Open Drawer of {eachSize} size
          </Button>
          <Drawer onClose={() => close(eachSize)} isOpen={isOpen[eachSize]} size={eachSize}>
            Proin ut dui sed metus pharetra hend rerit vel non mi. Nulla ornare faucibus ex, non
            facilisis nisl. Maecenas aliquet mauris ut tempus.
          </Drawer>
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

/* drawer/ssr-render-all.tsx — `renderAll` keeps the drawer's contents in the markup while the
 * drawer is closed, so a crawler and a server render both see them. */
function DrawerSSRRenderAll() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <React.Fragment>
      <Button onClick={() => setIsOpen(true)}>Open SSR Drawer (check source!)</Button>
      <Drawer renderAll onClose={() => setIsOpen(false)} isOpen={isOpen}>
        This content is SSR rendered and also rendered even if the drawer is closed! View it in the
        source or in your inspector!
      </Drawer>
    </React.Fragment>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * POPOVER — bw-docs/examples/popover/*.tsx (11 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* popover/stateless.tsx — the controlled Popover, held open by `isOpen`. */
function PopoverStateless() {
  const [css, theme] = useStyletron();
  return (
    <Popover
      isOpen
      content={<ParagraphSmall padding="scale500">hello world</ParagraphSmall>}
    >
      <div className={css({ ...theme.typography.font300 })}>Always open</div>
    </Popover>
  );
}

/* popover/stateful-click.tsx */
function PopoverStatefulClick() {
  return (
    <StatefulPopover
      content={<ParagraphSmall padding="scale500">hello world</ParagraphSmall>}
      accessibilityType={'tooltip'}
    >
      <Button>Open</Button>
    </StatefulPopover>
  );
}

/* popover/link.tsx — the anchor is a link rather than a button. */
function PopoverLink() {
  return (
    <StatefulPopover
      content={<ParagraphSmall padding="scale500">hello world</ParagraphSmall>}
      accessibilityType={'tooltip'}
    >
      <StyledLink href="javascript:void(0);" tabIndex={0}>
        Open
      </StyledLink>
    </StatefulPopover>
  );
}

/* popover/stateful-hover.tsx */
function PopoverStatefulHover() {
  const [css, theme] = useStyletron();
  return (
    <StatefulPopover
      content={<ParagraphSmall padding="scale500">hello world</ParagraphSmall>}
      accessibilityType={'tooltip'}
      triggerType={TRIGGER_TYPE.hover}
    >
      <span className={css({ ...theme.typography.font300 })}>Hover</span>
    </StatefulPopover>
  );
}

/* popover/placements.tsx — all thirteen PLACEMENT values; the trigger's label is the placement
 * being demonstrated. */
function PopoverPlacements() {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flexWrap: 'wrap',
        height: '560px',
      })}
    >
      {Object.values(PLACEMENT).map((key, index) => (
        <div style={{ padding: theme.sizing.scale700 }} key={index}>
          <StatefulPopover
            placement={PLACEMENT[key]}
            triggerType={TRIGGER_TYPE.hover}
            content={
              <ParagraphSmall padding="scale300">{`PLACEMENT.${PLACEMENT[key]}`}</ParagraphSmall>
            }
            accessibilityType={'tooltip'}
          >
            <Button>{PLACEMENT[key]}</Button>
          </StatefulPopover>
        </div>
      ))}
    </div>
  );
}

/* popover/with-arrow.tsx */
function PopoverWithArrow() {
  return (
    <StatefulPopover
      showArrow
      content={<ParagraphSmall padding="scale500">hello world</ParagraphSmall>}
      accessibilityType={'tooltip'}
    >
      <Button>Open</Button>
    </StatefulPopover>
  );
}

/* popover/dismiss.tsx — Esc and outside clicks are switched off, so the only way out is the
 * `close()` callback the content render prop receives. */
function PopoverDismiss() {
  const [css, theme] = useStyletron();
  const contentCx = css({
    padding: theme.sizing.scale500,
    maxWidth: '300px',
  });
  return (
    <StatefulPopover
      dismissOnEsc={false}
      dismissOnClickOutside={false}
      accessibilityType={'tooltip'}
      content={({ close }) => (
        <div className={contentCx}>
          <ParagraphSmall paddingBottom="scale400">
            content render prop is passed a <code>close()</code> callback so it you can manually
            trigger popover close from within
          </ParagraphSmall>
          <Button onClick={close}>Dismiss</Button>
        </div>
      )}
    >
      <Button>Click Me</Button>
    </StatefulPopover>
  );
}

/* popover/ref-handling.tsx — two ways to give the popover an anchor it can measure: a wrapper that
 * forwards the anchor props onto the Checkbox's Root, and a plain span around the Checkbox. */
const CheckboxWithRef = React.forwardRef((props: any, ref) => {
  const { children, ...restProps } = props;
  return (
    <StatefulCheckbox
      overrides={{
        Root: {
          props: { ref: ref, ...restProps },
        },
      }}
    >
      {children}
    </StatefulCheckbox>
  );
});

function PopoverRefHandling() {
  const [css] = useStyletron();
  return (
    <div
      className={css({
        paddingTop: '24px',
        paddingBottom: '24px',
      })}
    >
      <StatefulPopover
        placement={PLACEMENT.bottomLeft}
        triggerType={TRIGGER_TYPE.hover}
        content={<LabelSmall padding="scale300">This is a popover example</LabelSmall>}
        accessibilityType={'tooltip'}
      >
        <CheckboxWithRef>
          Created a wrapper component that renders Checkbox and passes popover's anchor props to the
          Checkbox's Root element.
        </CheckboxWithRef>
      </StatefulPopover>
      <br />
      <StatefulPopover
        placement={PLACEMENT.bottomLeft}
        triggerType={TRIGGER_TYPE.hover}
        content={<LabelSmall padding="scale300">This is a popover example</LabelSmall>}
        accessibilityType={'tooltip'}
      >
        <span>
          <StatefulCheckbox>Wrapped checkbox with props passed to the wrapper.</StatefulCheckbox>
        </span>
      </StatefulPopover>
    </div>
  );
}

/* popover/clipping.tsx — the popover is pinned open inside a scrolling box so it has to reposition
 * itself as the box moves. ↯ Uber's literal grey `backgroundColor` sits outside the theme's reach
 * and is re-sourced from it — mono500 is the step Base's own grey ramp puts on that value. */
function PopoverClipping() {
  const [css, theme] = useStyletron();
  return (
    <div className={css({ height: '300px', overflow: 'auto' })}>
      <div
        className={css({
          width: '100%',
          height: '700px',
          padding: '140px 0',
          backgroundColor: theme.colors.mono500,
          textAlign: 'center',
        })}
      >
        <StatefulPopover
          initialState={{ isOpen: true }}
          dismissOnEsc={false}
          dismissOnClickOutside={false}
          content={() => (
            <ParagraphSmall padding="scale500" maxWidth="200px">
              Popover will reposition itself to avoid being clipped!
              <br />
              <LabelSmall> Try scrolling in this box...</LabelSmall>
            </ParagraphSmall>
          )}
          placement={PLACEMENT.top}
        >
          <Button>Click Me</Button>
        </StatefulPopover>
      </div>
    </div>
  );
}

/* popover/overrides.tsx — Uber paints the arrow, the body and the inner with
 * `$theme.colors.warning`. Kept verbatim: the Rocoto theme collapses warning onto ink, so the demo
 * comes out ink-on-ink-on-white. That is the colour law working, not a bug. */
function PopoverOverrides() {
  return (
    <StatefulPopover
      initialState={{ isOpen: true }}
      showArrow
      overrides={{
        Arrow: {
          style: ({ $theme }) => ({
            backgroundColor: $theme.colors.warning,
          }),
        },
        Body: {
          style: ({ $theme }) => ({
            backgroundColor: $theme.colors.warning,
            borderTopLeftRadius: $theme.borders.radius200,
            borderTopRightRadius: $theme.borders.radius200,
            borderBottomRightRadius: $theme.borders.radius200,
            borderBottomLeftRadius: $theme.borders.radius200,
          }),
        },
        Inner: {
          style: ({ $theme }) => ({
            backgroundColor: $theme.colors.warning,
            borderTopLeftRadius: $theme.borders.radius200,
            borderTopRightRadius: $theme.borders.radius200,
            borderBottomRightRadius: $theme.borders.radius200,
            borderBottomLeftRadius: $theme.borders.radius200,
            color: $theme.colors.white,
          }),
        },
      }}
      content={<ParagraphSmall padding="scale500">hello world</ParagraphSmall>}
    >
      <Button>Click Me</Button>
    </StatefulPopover>
  );
}

/* popover/ssr-render-all.tsx */
function PopoverSSRRenderAll() {
  return (
    <StatefulPopover
      content={
        <ParagraphSmall padding="scale500">Server-side rendered (check source!)</ParagraphSmall>
      }
      accessibilityType={'tooltip'}
      renderAll
    >
      <Button>Always Rendered for SEO / server-side rendering</Button>
    </StatefulPopover>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TOOLTIP — bw-docs/examples/tooltip/*.tsx (2 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* tooltip/stateful.tsx */
function TooltipStateful() {
  const [css, theme] = useStyletron();
  return (
    <div>
      You can use tooltips in many places, including inline text{' '}
      <StatefulTooltip accessibilityType={'tooltip'} content="Tooltips display short messages.">
        <span
          className={css({
            borderBottomWidth: '1px',
            borderBottomStyle: 'dotted',
            borderBottomColor: `${theme.colors.primary500}`,
            color: theme.colors.primary500,
          })}
          tabIndex={0}
        >
          such as this
        </span>
      </StatefulTooltip>
      . Tooltips are essentially just a Popover with a few style tweaks, so you can use all the
      features that Popover supports.
    </div>
  );
}

/* tooltip/stateful-complex-content.tsx — the tooltip's body is dark, so its contents need a theme
 * that reads against it. ↯ Uber wraps them in Base's stock `DarkTheme`, a second theme object that
 * bypasses Rocoto's, so this snippet would come out in Base's own typeface. The structure is the
 * point of the example, so it stays and the theme is built here instead: Base's own dark ramp,
 * saffron on accent, and the page's own typography taken straight off RocotoTheme so type has one
 * source. The tokens this content actually reaches for are greyscale in Base's dark ramp
 * (contentPrimary and linkText land on the same near-white step), so it brings no colour of its
 * own onto the page.
 * Note the signature: in baseui 16 createDarkTheme/createLightTheme take a THEME-shaped object, so
 * a brand colour goes under `colors`, not at the top level. */
const RocotoDarkTheme = createDarkTheme({
  colors: { accent: rocoto.saffron },
  typography: RocotoTheme.typography,
});

function ComplexContent() {
  return (
    <ThemeProvider theme={RocotoDarkTheme}>
      Please click this link here:{` `}
      <StyledLink href="#">Click Me!</StyledLink>
    </ThemeProvider>
  );
}

function TooltipStatefulComplexContent() {
  const [css, theme] = useStyletron();
  return (
    <div>
      You can use tooltips in many places, including inline text{' '}
      <StatefulTooltip accessibilityType={'tooltip'} content={ComplexContent} autoFocus>
        <span
          className={css({
            borderBottomWidth: '1px',
            borderBottomStyle: 'dotted',
            borderBottomColor: `${theme.colors.primary500}`,
            color: theme.colors.primary500,
          })}
          tabIndex={0}
        >
          such as this
        </span>
      </StatefulTooltip>
      . Tooltips are essentially just a Popover with a few style tweaks, so you can use all the
      features that Popover supports. Tooltips with interactive content, such as links or buttons,
      should use the autoFocus or focusLock props. This ensures the content is within the keyboard
      tab order of the page.
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PAGE
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

export default function OverlaysSection() {
  return (
    <>
      <Section
        t="Modal"
        n="Use it to put focused content, an action or an alert on top of the current view, keeping the context of the view underneath."
      >
        <Grid>
          <Tile
            name="Modal With Button Trigger"
            rule="header · body · footer · shaded overlay — the standard modal, dismissible by the X, by Esc and by a click outside"
            span={4}
          >
            <ModalBasic />
          </Tile>
          <Tile
            name="Placing initial focus"
            rule="autoFocus on the footer's primary button; FocusOnce lands focus on the header first"
            span={4}
          >
            <ModalAutoFocus />
          </Tile>
          <Tile
            name="Setting the size of the modal"
            rule="Dialog override at 80vw × 80vh, column flex, ModalBody at flex 1 1 0"
            span={4}
          >
            <ModalSized />
          </Tile>
          <Tile
            name="Dealing with a buried interactive element"
            rule="five paragraphs bury the footer button; WAI-ARIA asks focus to land on the header rather than skip the content"
            span={6}
          >
            <ModalBuriedInteractiveElement />
          </Tile>
          <Tile
            name="Nested"
            rule="a second modal confirms the first; the confirmation's state lives outside it"
            span={6}
          >
            <ModalNested />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Dialog"
        n="Use it to focus a person's attention on a single-step task, question or message, floating on top of the surface underneath."
      >
        <Grid>
          <Tile
            name="Non-modal dialog"
            rule="hasOverlay={false} — a popup rather than a modal; numHeadingLines={1} truncates the heading"
            span={6}
          >
            <DialogWithoutOverlay />
          </Tile>
          <Tile
            name="Artwork"
            rule="the artwork prop takes a component or an element; decorative artwork is a background-image, semantic artwork an img"
            span={6}
          >
            <DialogWithBackgroundImage />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Drawer"
        n="Use it to slide a panel in from an edge of the screen, holding content or actions beside the view that is already there."
      >
        <Grid>
          <Tile name="Drawer with anchor" rule="ANCHOR: left · right · top · bottom" span={4}>
            <DrawerAnchors />
          </Tile>
          <Tile
            name="Drawer with different size"
            rule="SIZE: default 500px · full 100% · auto hugs its content"
            span={4}
          >
            <DrawerSizes />
          </Tile>
          <Tile
            name="Drawer with renderAll for SSR / SEO"
            rule="renderAll keeps the contents in the markup while the drawer is closed"
            span={4}
          >
            <DrawerSSRRenderAll />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Popover"
        n="Use it to describe the difference between visually similar elements, and to hold information a person stops needing once the interface is familiar."
      >
        <Grid>
          <Tile name="Popover stateless example" rule="controlled by isOpen" span={4}>
            <PopoverStateless />
          </Tile>
          <Tile name="Popover opens on Click" rule="StatefulPopover, the default trigger" span={4}>
            <PopoverStatefulClick />
          </Tile>
          <Tile name="Popover opens on link Click" rule="the anchor is a StyledLink" span={4}>
            <PopoverLink />
          </Tile>
          <Tile name="Popover Opens on Hover" rule="triggerType=hover" span={4}>
            <PopoverStatefulHover />
          </Tile>
          <Tile name="Popover With Arrow" rule="showArrow" span={4}>
            <PopoverWithArrow />
          </Tile>
          <Tile
            name="Popover Close from Content"
            rule="Esc and outside clicks switched off; content receives close()"
            span={4}
          >
            <PopoverDismiss />
          </Tile>
          <Tile
            name="Popover Available Placements"
            rule="all thirteen PLACEMENT values, on hover"
            span={6}
          >
            <PopoverPlacements />
          </Tile>
          <Tile
            name="Anchor ref handling example"
            rule="a forwardRef wrapper onto Checkbox's Root, and a plain span around it"
            span={6}
          >
            <PopoverRefHandling />
          </Tile>
          <Tile
            name="Clipping Avoidance"
            rule="pinned open in a 300px scroll box over a 700px page — scroll it"
            span={6}
          >
            <PopoverClipping />
          </Tile>
          <Tile
            name="Popover with Overrides"
            rule="Arrow · Body · Inner painted with $theme.colors.warning — the theme collapses it onto ink"
            span={6}
          >
            <PopoverOverrides />
          </Tile>
          <Tile
            name="SSR Popover"
            rule="renderAll keeps the content in the markup while the popover is closed"
            span={6}
          >
            <PopoverSSRRenderAll />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Tooltip"
        n="Use it to give a short piece of extra information on hover or click — a Popover with a few style tweaks, so every Popover feature works here too."
      >
        <Grid>
          <Tile
            name="Tooltip stateful example"
            rule="inline text trigger; the dotted underline marks it"
            span={6}
          >
            <TooltipStateful />
          </Tile>
          <Tile
            name="Tooltip stateful example with complex content"
            rule="interactive content needs autoFocus or focusLock; the content carries its own dark theme for contrast"
            span={6}
          >
            <TooltipStatefulComplexContent />
          </Tile>
        </Grid>
      </Section>
    </>
  );
}
