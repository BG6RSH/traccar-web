import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { IconButton, Paper, Slider, Toolbar, Typography, Switch, FormControlLabel } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import TuneIcon from '@mui/icons-material/Tune';
import DownloadIcon from '@mui/icons-material/Download';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import MapView, { map } from '../map/core/MapView';
import MapRoutePath from '../map/MapRoutePath';
import MapRoutePoints from '../map/MapRoutePoints';
import MapPositionMarkers from '../map/MapPositionMarkers';
import { formatTime } from '../common/util/formatter';
import ReportFilter from '../reports/components/ReportFilter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useCatchCallback } from '../reactHelper';
import { errorsActions } from '../store';
import MapCamera from '../map/MapCamera';
import MapGeofence from '../map/MapGeofence';
import StatusCard from '../common/components/StatusCard';
import MapScale from '../map/MapScale';
import BackIcon from '../common/components/BackIcon';
import fetchOrThrow from '../common/util/fetchOrThrow';
import MapOverlay from '../map/overlay/MapOverlay';

const useStyles = makeStyles()((theme) => ({
  root: {
    height: '100%',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    zIndex: 3,
    left: 0,
    top: 0,
    margin: theme.spacing(1.5),
    width: theme.dimensions.drawerWidthDesktop,
    [theme.breakpoints.down('md')]: {
      width: '100%',
      margin: 0,
    },
  },
  title: {
    flexGrow: 1,
  },
  slider: {
    width: '100%',
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  formControlLabel: {
    height: '100%',
    width: '100%',
    paddingRight: theme.spacing(1),
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
    [theme.breakpoints.down('md')]: {
      margin: theme.spacing(1),
    },
    [theme.breakpoints.up('md')]: {
      marginTop: theme.spacing(1),
    },
  },
}));

const ReplayPage = () => {
  const t = useTranslation();
  const { classes } = useStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const timerRef = useRef();

  const [searchParams] = useSearchParams();

  const defaultDeviceId = useSelector((state) => state.devices.selectedId);

  const [positions, setPositions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState(defaultDeviceId);
  const [showCard, setShowCard] = useState(false);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [graspRoadEnabled, setGraspRoadEnabled] = useState(false);
  const [correctedPositions, setCorrectedPositions] = useState([]);
  const [mapGcj02, setMapGcj02] = useState(map.coordinateSystem === 'gcj02');

  useEffect(() => {
    const onStyleData = () => {
      const gcj02 = map.coordinateSystem === 'gcj02';
      setMapGcj02(gcj02);
      if (!gcj02) {
        setCorrectedPositions([]);
        setGraspRoadEnabled(false);
      }
    };
    map.on('styledata', onStyleData);
    return () => map.off('styledata', onStyleData);
  }, []);

  const loaded = Boolean(from && to && !loading && positions.length);

  const deviceName = useSelector((state) => {
    if (selectedDeviceId) {
      const device = state.devices.items[selectedDeviceId];
      if (device) {
        return device.name;
      }
    }
    return null;
  });

  useEffect(() => {
    if (!from && !to) {
      setPositions([]);
      setCorrectedPositions([]);
      setGraspRoadEnabled(false);
    }
  }, [from, to, setPositions]);

  useEffect(() => {
    if (playing && positions.length > 0) {
      timerRef.current = setInterval(() => {
        setIndex((index) => index + 1);
      }, 500);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [playing, positions]);

  useEffect(() => {
    if (index >= positions.length - 1) {
      clearInterval(timerRef.current);
      setPlaying(false);
    }
  }, [index, positions]);

  const onPointClick = useCallback(
    (_, index) => {
      setIndex(index);
    },
    [setIndex],
  );

  const onMarkerClick = useCallback(
    (positionId) => {
      setShowCard(!!positionId);
    },
    [setShowCard],
  );

  const onShow = useCatchCallback(
    async ({ deviceIds, from, to }) => {
      const deviceId = deviceIds.find(() => true);
      setLoading(true);
      setSelectedDeviceId(deviceId);
      setCorrectedPositions([]);
      setGraspRoadEnabled(false);
      const query = new URLSearchParams({ deviceId, from, to });
      try {
        const response = await fetchOrThrow(`/api/positions?${query.toString()}`);
        setIndex(0);
        const positions = await response.json();
        setPositions(positions);
        if (!positions.length) {
          throw Error(t('sharedNoData'));
        }
        setFilterOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  const handleGraspRoad = useCallback(async () => {
    if (graspRoadEnabled) {
      setGraspRoadEnabled(false);
      return;
    }
    if (correctedPositions.length) {
      setGraspRoadEnabled(true);
      return;
    }
    try {
      setLoading(true);
      const query = new URLSearchParams({
        deviceId: selectedDeviceId,
        from,
        to,
      });
      const response = await fetchOrThrow(`/api/positions/corrected?${query.toString()}`);
      const data = await response.json();
      if (!data.length) {
        throw Error(t('sharedNoData'));
      }
      setCorrectedPositions(data);
      setGraspRoadEnabled(true);
    } catch (error) {
      dispatch(errorsActions.push(error.message));
    } finally {
      setLoading(false);
    }
  }, [graspRoadEnabled, correctedPositions, selectedDeviceId, from, to, dispatch, t]);

  const handleDownload = () => {
    const query = new URLSearchParams({ deviceId: selectedDeviceId, from, to });
    window.location.assign(`/api/positions/kml?${query.toString()}`);
  };

  const markerPosition = useMemo(() => {
    if (index >= positions.length) {
      return null;
    }
    const original = positions[index];
    if (!graspRoadEnabled || !correctedPositions.length) {
      return original;
    }
    const target = new Date(original.fixTime).getTime();
    let lo = 0;
    let hi = correctedPositions.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (new Date(correctedPositions[mid].fixTime).getTime() < target) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    let best = lo;
    if (lo > 0) {
      const prevDiff = Math.abs(new Date(correctedPositions[lo - 1].fixTime).getTime() - target);
      const currDiff = Math.abs(new Date(correctedPositions[lo].fixTime).getTime() - target);
      if (prevDiff < currDiff) {
        best = lo - 1;
      }
    }
    return correctedPositions[best];
  }, [index, positions, graspRoadEnabled, correctedPositions]);

  return (
    <div className={classes.root}>
      <MapView>
        <MapOverlay />
        <MapGeofence />
        <MapRoutePath positions={positions} />
        {graspRoadEnabled && correctedPositions.length > 0 && (
          <MapRoutePath
            key={`corrected-${mapGcj02}`}
            positions={correctedPositions}
            lineDash={[2, 4]}
            color="#831eba"
            lineWidth={5}
            lineOpacity={0.6}
            sourceCoordinateSystem={correctedPositions[0]?.attributes?.correctedCoordinateSystem || 'gcj02'}
          />
        )}
        <MapRoutePoints positions={positions} onClick={onPointClick} showSpeedControl />
        {markerPosition && (
          <MapPositionMarkers
            positions={[markerPosition]}
            onMarkerClick={onMarkerClick}
            titleField="fixTime"
            sourceCoordinateSystem={markerPosition.attributes?.correctedCoordinateSystem}
          />
        )}
      </MapView>
      <MapScale />
      <MapCamera positions={positions} />
      <div className={classes.sidebar}>
        <Paper elevation={3} square>
          <Toolbar>
            <IconButton edge="start" sx={{ mr: 2 }} onClick={() => navigate(-1)}>
              <BackIcon />
            </IconButton>
            <Typography variant="h6" className={classes.title}>
              {t('reportReplay')}
            </Typography>
            {loaded && (
              <>
                <IconButton onClick={handleDownload}>
                  <DownloadIcon />
                </IconButton>
                <IconButton edge="end" onClick={() => setFilterOpen((open) => !open)}>
                  <TuneIcon />
                </IconButton>
              </>
            )}
          </Toolbar>
        </Paper>
        <Paper className={classes.content} square>
          {loaded && !filterOpen && (
            <>
              <Typography variant="subtitle1" align="center">
                {deviceName}
              </Typography>
              <Slider
                className={classes.slider}
                max={positions.length - 1}
                step={null}
                marks={positions.map((_, index) => ({ value: index }))}
                value={index}
                onChange={(_, index) => setIndex(index)}
              />
              <div className={classes.controls}>
                <Typography variant="caption">{`${index + 1}/${positions.length}`}</Typography>
                <IconButton
                  onClick={() => setIndex((index) => index - 1)}
                  disabled={playing || index <= 0}
                >
                  <FastRewindIcon />
                </IconButton>
                <IconButton
                  onClick={() => setPlaying(!playing)}
                  disabled={index >= positions.length - 1}
                >
                  {playing ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>
                <IconButton
                  onClick={() => setIndex((index) => index + 1)}
                  disabled={playing || index >= positions.length - 1}
                >
                  <FastForwardIcon />
                </IconButton>
                <Typography variant="caption">
                  {formatTime(positions[index].fixTime, 'seconds')}
                </Typography>
              </div>
              {mapGcj02 && (
                <FormControlLabel
                  control={<Switch checked={graspRoadEnabled} onChange={handleGraspRoad} size="small" />}
                  label={t('reportGraspRoad')}
                  className={classes.formControlLabel}
                />
              )}
            </>
          )}
          <div style={{ display: loaded && !filterOpen ? 'none' : 'block' }}>
            <ReportFilter onShow={onShow} deviceType="single" loading={loading} />
          </div>
        </Paper>
      </div>
      {showCard && index < positions.length && (
        <StatusCard
          deviceId={selectedDeviceId}
          position={positions[index]}
          onClose={() => setShowCard(false)}
          disableActions
        />
      )}
    </div>
  );
};

export default ReplayPage;
