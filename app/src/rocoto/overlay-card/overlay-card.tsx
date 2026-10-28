/* OVERLAY CARD — the chromeless overlay.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx` for its file layout, prop idiom
 * and overrides contract, and built on Base Web's own `src/modal/modal.tsx` for everything a
 * layer actually needs: the mount/visible state machine, the `Layer` subscription that gives it
 * Escape and outside-click, `react-focus-lock` for the focus trap and focus return, and the
 * mount-node scroll lock. Base Web is MIT, Copyright (c) Uber Technologies, Inc. None of that
 * machinery is reimplemented here — reimplementing a focus trap is how overlays get shipped that
 * the keyboard can walk straight out of.
 *
 * WHY IT EXISTS. Base ships the chromed overlay twice over — Modal and Drawer both give you a
 * header bar to name the place, a body to work in and a footer bar to act from. That anatomy is
 * right for a task you work IN: you may be in there a while, so the overlay tells you where you
 * are and what your exits are. It is wrong for the far commoner thing, which is ONE decision you
 * make and it closes. There the header repeats what the body already says, the footer bar draws a
 * rule under two buttons that need no rule, and the close button offers a third way out of a
 * choice that has two. So this is the same layer, bare: a ground, a radius, a gutter, and the
 * decision. It is dismissed by the scrim or by Escape, and the card's own action closes it.
 *
 * THE DOCTRINE, STATED ONCE: chrome is for staying, and a bare card is for leaving. A card that
 * grows a header has become a task, and at that point it should be a Modal — the two are not
 * variants of one control, they are the two answers, and the choice between them is the design
 * decision this component exists to make explicit.
 *
 * THE SAME CARD DOCKS. `placement="bottom"` puts it on the bottom edge with its top corners
 * rounded, which is how a phone reads it. It is the same component and the same motion tokens, so
 * a decision does not need rebuilding to cross a form factor.
 */
import * as React from 'react';
import FocusLock from 'react-focus-lock';
import { getOverrides } from 'baseui/helpers/overrides';
import { Layer, LayersContext } from 'baseui/layer';
import { isFocusVisible, forkFocus, forkBlur } from 'baseui/utils/focusVisible';
import { CLOSE_SOURCE, EXIT_DELAY_MS, PLACEMENT, ROLE, SCRIM, SIZE } from './constants';
import { Root as StyledRoot, Scrim as StyledScrim, Card as StyledCard } from './styled-components';
import type {
  CloseSource,
  OverlayCardProps,
  OverlayCardState,
  Phase,
  SharedStyleProps,
} from './types';
import type { SyntheticEvent } from 'react';

/** The four moments, derived from the two flags Base's Modal already keeps. `isVisible` is raised
 *  a frame after the card mounts and lowered once the closing phase has finished painting, so
 *  these two flags name all four states between them with nothing left over. */
function phaseOf(mounted: boolean, isOpen: boolean, isVisible: boolean): Phase {
  if (!mounted) return 'closed';
  if (isOpen) return isVisible ? 'open' : 'opening';
  return isVisible ? 'closing' : 'closed';
}

/** Keep Base's single event/focus manager while giving portalled child menus their proper level.
 * A menu is outside the card's DOM, so inheriting the app's default z-index puts it under a scrim. */
function OverlayChildLayers({ children }: { children: React.ReactNode }) {
  const parent = React.useContext(LayersContext);
  const value = React.useMemo(() => ({ ...parent, zIndex: Math.max(9, parent.zIndex ?? 0) + 1 }), [parent]);
  return <LayersContext.Provider value={value}>{children}</LayersContext.Provider>;
}

class OverlayCard extends React.Component<OverlayCardProps, OverlayCardState> {
  static defaultProps: Partial<OverlayCardProps> = {
    animate: true,
    autoFocus: true,
    dismissable: true,
    focusLock: true,
    isOpen: false,
    overrides: {},
    placement: PLACEMENT.center,
    returnFocus: true,
    role: ROLE.dialog,
    scrim: SCRIM.dim,
    size: SIZE.default,
  };

  exitTimer: ReturnType<typeof setTimeout> | undefined | null;
  enterFrame: ReturnType<typeof requestAnimationFrame> | undefined | null;
  rootRef = React.createRef<HTMLElement>();
  cardRef = React.createRef<HTMLElement>();
  lastMountNodeOverflowStyle: string | undefined | null = null;

  state: OverlayCardState = {
    isVisible: false,
    mounted: false,
    isFocusVisible: false,
  };

  componentDidMount() {
    this.setState({ mounted: true });
  }

  componentWillUnmount() {
    this.resetMountNodeScroll();
    this.clearTimers();
  }

  componentDidUpdate(prevProps: OverlayCardProps, prevState: OverlayCardState) {
    const { isOpen } = this.props;
    if (
      isOpen !== prevProps.isOpen ||
      (isOpen && this.state.mounted && !prevState.mounted)
    ) {
      if (isOpen) {
        this.didOpen();
      } else {
        this.didClose();
      }
    }

    const before = phaseOf(prevState.mounted, !!prevProps.isOpen, prevState.isVisible);
    const now = this.phase();
    if (before !== now && this.props.onPhaseChange) {
      this.props.onPhaseChange(now);
    }
  }

  phase(): Phase {
    return phaseOf(this.state.mounted, !!this.props.isOpen, this.state.isVisible);
  }

  /* FOCUS VISIBILITY — Base's own fork, so a pointer arrival draws no ring and a keyboard one
   * does. The card is a focus target in its own right whenever `autoFocus` is off or nothing
   * inside it can take focus. */
  handleFocus = (event: SyntheticEvent) => {
    if (isFocusVisible(event)) {
      this.setState({ isFocusVisible: true });
    }
  };

  handleBlur = () => {
    if (this.state.isFocusVisible !== false) {
      this.setState({ isFocusVisible: false });
    }
  };

  /* SCROLL LOCK — Base's own, and it is why `mountNode` is worth carrying: the node the card
   * mounts into is the node whose scroll gets held, so a card inside a phone housing holds the
   * housing and leaves the page alone. A card with no scrim leaves scrolling where it is, because
   * a surface that stays live to the pointer has no business being frozen. */
  getMountNode(): HTMLElement {
    return this.props.mountNode || (document.body as HTMLElement);
  }

  disableMountNodeScroll() {
    if (this.props.scrim === SCRIM.none) return;
    const mountNode = this.getMountNode();
    this.lastMountNodeOverflowStyle = mountNode.style.overflow || '';
    mountNode.style.overflow = 'hidden';
  }

  resetMountNodeScroll() {
    const mountNode = this.getMountNode();
    const lastStyle = this.lastMountNodeOverflowStyle;
    if (mountNode && lastStyle !== null) {
      // only put back what we took: if the overflow is no longer ours, something else owns it now
      if (mountNode.style.overflow === 'hidden') {
        mountNode.style.overflow = lastStyle || '';
      }
      this.lastMountNodeOverflowStyle = null;
    }
  }

  onEscape = () => {
    if (!this.props.dismissable) return;
    this.triggerClose(CLOSE_SOURCE.escape);
  };

  /* CLICKING AWAY. `Layer` hands the topmost layer the document's mousedown, so a card opened
   * from inside a modal takes this before the modal does, and the layers unwind one at a time.
   *
   * What counts as "away" depends on whether there is a scrim to land on. With one, the gesture
   * has to land on the layer itself — that keeps the button that opened the card, which is
   * underneath the scrim and unreachable, from closing and reopening it in one press. With
   * `scrim="none"` nothing catches the pointer, so anywhere outside the card is away. */
  onDocumentClick = (e: MouseEvent) => {
    if (!this.props.dismissable) return;
    const target = e.target;
    const card = this.cardRef.current;
    if (!card || !(target instanceof Node) || card.contains(target)) return;
    if (this.props.scrim === SCRIM.none) {
      this.triggerClose(CLOSE_SOURCE.scrim);
      return;
    }
    const root = this.rootRef.current;
    if (root && root.contains(target)) {
      this.triggerClose(CLOSE_SOURCE.scrim);
    }
  };

  clearTimers() {
    if (this.exitTimer) clearTimeout(this.exitTimer);
    if (this.enterFrame) cancelAnimationFrame(this.enterFrame);
  }

  didOpen() {
    // the layer can come up already scrolled; other libraries reset this too
    const rootRef = this.rootRef.current;
    if (rootRef) rootRef.scrollTop = 0;

    this.clearTimers();
    this.disableMountNodeScroll();

    // one frame in the opening phase, so the browser has a `from` to transition out of
    this.enterFrame = requestAnimationFrame(() => {
      this.setState({ isVisible: true });
    });
  }

  didClose() {
    this.resetMountNodeScroll();
    this.exitTimer = setTimeout(this.exitComplete, EXIT_DELAY_MS);
  }

  exitComplete = () => {
    this.setState({ isVisible: false });
  };

  triggerClose(source?: CloseSource) {
    // no source means `isOpen` changed on its own — that was the consumer, so there is nothing
    // to tell them. Base's Modal draws the same line.
    if (this.props.onClose && source) {
      this.props.onClose({ closeSource: source });
    }
  }

  getSharedProps(): SharedStyleProps {
    const { animate, placement, scrim, size, mountNode } = this.props;
    return {
      $animate: !!animate,
      $phase: this.phase(),
      $placement: placement || PLACEMENT.center,
      $scrim: scrim || SCRIM.dim,
      $size: size === undefined ? SIZE.default : size,
      $contained: !!mountNode,
      $isFocusVisible: this.state.isFocusVisible,
    };
  }

  getChildren() {
    const { children } = this.props;
    return typeof children === 'function' ? children() : children;
  }

  renderCard(content: React.ReactNode) {
    const {
      overrides = {},
      role,
      autoFocus,
      focusLock,
      returnFocus,
      scrim,
      ariaLabel,
      ariaLabelledBy,
    } = this.props;

    const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
    const [Scrim, scrimProps] = getOverrides(overrides.Scrim, StyledScrim);
    const [Card, cardProps] = getOverrides(overrides.Card, StyledCard);

    const shared = this.getSharedProps();

    return (
      <FocusLock
        disabled={!focusLock}
        // let focus out when the card is inside an iframe, exactly as Base does
        crossFrame={false}
        returnFocus={returnFocus}
        autoFocus={autoFocus}
        /* `react-focus-lock` wraps its children in a real element, and that element is an in-flow
         * child of whatever the card mounted into. Against `document.body` nobody notices; inside
         * a mount node of your own it is a box that joins that node's layout and moves the
         * content the card is supposed to be floating over. `display: contents` takes the wrapper
         * out of layout while leaving the lock's DOM exactly where it needs to be. */
        lockProps={{ style: { display: 'contents' } }}
      >
        <Root
          data-baseweb="overlay-card"
          ref={this.rootRef as React.Ref<HTMLElement>}
          {...shared}
          {...rootProps}
        >
          <Scrim {...shared} {...scrimProps}>
            <Card
              ref={this.cardRef as React.Ref<HTMLElement>}
              tabIndex={-1}
              role={role}
              // a card with no scrim leaves the page live, so it is not modal and must not say
              // that it is
              aria-modal={scrim === SCRIM.none ? undefined : true}
              aria-label={ariaLabelledBy ? undefined : ariaLabel || 'dialog'}
              aria-labelledby={ariaLabelledBy}
              {...shared}
              {...cardProps}
              onFocus={forkFocus(cardProps, this.handleFocus)}
              onBlur={forkBlur(cardProps, this.handleBlur)}
            >
              <OverlayChildLayers>{content}</OverlayChildLayers>
            </Card>
          </Scrim>
        </Root>
      </FocusLock>
    );
  }

  render() {
    // portals need a browser, and the closing phase needs the card to outlive `isOpen`
    const present = this.state.mounted && (this.props.isOpen || this.state.isVisible);
    if (!present) return null;

    return (
      <Layer
        onEscape={this.onEscape}
        onDocumentClick={this.onDocumentClick}
        mountNode={this.props.mountNode}
      >
        {this.renderCard(this.getChildren())}
      </Layer>
    );
  }
}

export default OverlayCard;
