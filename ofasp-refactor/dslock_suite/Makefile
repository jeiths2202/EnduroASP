
CC=gcc
CFLAGS=-O2 -fPIC -I./src/include -Wall -Wextra
BUILD=build

all: prep $(BUILD)/libdslock.so $(BUILD)/dslockctl $(BUILD)/libdsio.so $(BUILD)/sample_dsio $(BUILD)/test_lock_holder $(BUILD)/test_lock_requester $(BUILD)/test_signal_cleanup $(BUILD)/test_ttl_cleanup $(BUILD)/test_admin_api $(BUILD)/test_dslockctl_admin

prep:
	mkdir -p $(BUILD)

$(BUILD)/dslock.o: src/dslock/dslock.c src/include/dslock.h src/include/error.h
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/libdslock.so: $(BUILD)/dslock.o
	$(CC) -shared -o $@ $^

$(BUILD)/dslockctl.o: src/dslock/dslockctl.c src/include/dslock.h src/include/error.h
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/dslockctl: $(BUILD)/dslockctl.o $(BUILD)/libdslock.so
	$(CC) -O2 -o $@ $(BUILD)/dslockctl.o -L$(BUILD) -ldslock

$(BUILD)/dsio.o: src/dsio/dsio.c src/include/dsio.h src/include/dslock.h src/include/error.h
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/dsio_json.o: src/dsio/dsio_json.c src/include/dsio.h src/include/error.h
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/libdsio.so: $(BUILD)/dsio.o $(BUILD)/dsio_json.o $(BUILD)/libdslock.so
	$(CC) -shared -o $@ $(BUILD)/dsio.o $(BUILD)/dsio_json.o -L$(BUILD) -ldslock

$(BUILD)/sample_dsio.o: samples/sample_dsio.c src/include/dsio.h src/include/dslock.h src/include/error.h
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/sample_dsio: $(BUILD)/sample_dsio.o $(BUILD)/libdsio.so $(BUILD)/libdslock.so
	$(CC) -O2 -o $@ $(BUILD)/sample_dsio.o -L$(BUILD) -ldsio -ldslock

$(BUILD)/test_lock_holder.o: tests/test_lock_holder.c src/include/dsio.h src/include/dslock.h src/include/error.h
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/test_lock_holder: $(BUILD)/test_lock_holder.o $(BUILD)/libdsio.so $(BUILD)/libdslock.so
	$(CC) -O2 -o $@ $(BUILD)/test_lock_holder.o -L$(BUILD) -ldsio -ldslock

$(BUILD)/test_lock_requester.o: tests/test_lock_requester.c src/include/dsio.h src/include/dslock.h src/include/error.h
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/test_lock_requester: $(BUILD)/test_lock_requester.o $(BUILD)/libdsio.so $(BUILD)/libdslock.so
	$(CC) -O2 -o $@ $(BUILD)/test_lock_requester.o -L$(BUILD) -ldsio -ldslock

$(BUILD)/test_signal_cleanup.o: tests/test_signal_cleanup.c src/include/dslock.h src/include/error.h
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/test_signal_cleanup: $(BUILD)/test_signal_cleanup.o $(BUILD)/libdslock.so
	$(CC) -O2 -o $@ $(BUILD)/test_signal_cleanup.o -L$(BUILD) -ldslock

$(BUILD)/test_ttl_cleanup.o: tests/test_ttl_cleanup.c src/include/dslock.h src/include/error.h
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/test_ttl_cleanup: $(BUILD)/test_ttl_cleanup.o $(BUILD)/libdslock.so
	$(CC) -O2 -o $@ $(BUILD)/test_ttl_cleanup.o -L$(BUILD) -ldslock

$(BUILD)/test_admin_api.o: tests/test_admin_api.c src/include/dslock.h src/include/error.h
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/test_admin_api: $(BUILD)/test_admin_api.o $(BUILD)/libdslock.so
	$(CC) -O2 -o $@ $(BUILD)/test_admin_api.o -L$(BUILD) -ldslock

$(BUILD)/test_dslockctl_admin.o: tests/test_dslockctl_admin.c src/include/dslock.h src/include/error.h
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/test_dslockctl_admin: $(BUILD)/test_dslockctl_admin.o $(BUILD)/libdslock.so
	$(CC) -O2 -o $@ $(BUILD)/test_dslockctl_admin.o -L$(BUILD) -ldslock

clean:
	rm -rf $(BUILD)

test: all
	DSIO_ROOT=/dev/shm DSLOCK_LOG=0 python3 tests/stress_lock.py VOL/APP/FILE
	DSIO_ROOT=/dev/shm DSLOCK_LOG=0 python3 tests/test_dsio_integrated.py

.PHONY: all prep clean test
